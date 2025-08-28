package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const (
	CerebrasAPIURL = "https://api.cerebras.ai/v1/chat/completions"
	ModelGPTOSS    = "gpt-oss-120b"
	SystemPrompt   = "You are Kite, a helpful Git assistant. You help users with Git operations, code reviews, and development tasks. Be concise and practical in your responses."
)

// CerebrasMessage represents a message in the chat
type CerebrasMessage struct {
	Role       string             `json:"role"`
	Content    string             `json:"content"`
	ToolCallID string             `json:"tool_call_id,omitempty"`
	Name       string             `json:"name,omitempty"`
	ToolCalls  []CerebrasToolCall `json:"tool_calls,omitempty"`
}

// CerebrasRequest represents the request body for chat completions
type CerebrasRequest struct {
	Model       string            `json:"model"`
	Messages    []CerebrasMessage `json:"messages"`
	Stream      bool              `json:"stream"`
	Temperature float64           `json:"temperature,omitempty"`
	MaxTokens   int               `json:"max_completion_tokens,omitempty"`
	Reasoning   string            `json:"reasoning_effort,omitempty"`
	Tools       []ToolDefinition  `json:"tools,omitempty"`
}

// CerebrasResponse represents a streaming response chunk
type CerebrasResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index int `json:"index"`
		Delta struct {
			Content string `json:"content,omitempty"`
			Role    string `json:"role,omitempty"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason,omitempty"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage,omitempty"`
}

// NonStreamingCerebrasResponse represents a non-streaming response for tool calls
type NonStreamingCerebrasResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role      string             `json:"role"`
			Content   string             `json:"content"`
			ToolCalls []CerebrasToolCall `json:"tool_calls,omitempty"`
		} `json:"message"`
		FinishReason string `json:"finish_reason,omitempty"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage,omitempty"`
}

// CerebrasToolCall represents a tool call in the Cerebras response
type CerebrasToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// ToolCallResponse represents a tool call response
type ToolCallResponse struct {
	Role       string `json:"role"`
	Content    string `json:"content"`
	ToolCallID string `json:"tool_call_id"`
	Name       string `json:"name,omitempty"`
}

// CerebrasClient handles communication with the Cerebras API
type CerebrasClient struct {
	apiKey  string
	client  *http.Client
	backend *BackendClient
	tools   []ToolDefinition
}

// NewCerebrasClient creates a new Cerebras client
func NewCerebrasClient() (*CerebrasClient, error) {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		// It's okay if .env doesn't exist, we'll fall back to system environment
		fmt.Printf("Note: .env file not found, using system environment variables\n")
	}

	apiKey := os.Getenv("CEREBRAS_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("CEREBRAS_API_KEY environment variable not set. Please set it in your .env file or system environment")
	}

	// Initialize backend client
	backend, err := NewBackendClient()
	if err != nil {
		fmt.Printf("Warning: Failed to initialize backend client: %v\n", err)
		backend = nil
	}

	// Get available tools
	tools := GetTools()

	return &CerebrasClient{
		apiKey: apiKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		backend: backend,
		tools:   tools,
	}, nil
}

// StreamChatCompletion streams a chat completion response
func (c *CerebrasClient) StreamChatCompletion(messages []CerebrasMessage, responseChan chan<- string, errorChan chan<- error) {
	defer close(responseChan)
	defer close(errorChan)

	// Add system prompt at the beginning of messages
	systemMessage := CerebrasMessage{
		Role: "system",
		Content: `Your name is Kite and you're an expert GitHub repository management assistant powered by GPT-OSS. You have access to tools for managing repositories, branches, issues, and pull requests.

CRITICAL: When executing tools, ONLY execute the tool and return the result. DO NOT add any additional commentary, explanations, or text after tool execution. The tool results are complete and self-explanatory. If you need to use a tool, do not include any text content in your response - only use the tool. NEVER generate text content when using tools - only call the tool and stop. IMPORTANT: When you use a tool, do not write any text in the content field - only make the tool call.

When the user greets you, respond with "Hello, I'm Kite, your personal git assistant. How may I help you today?"

When the user asks you what you can do, respond with "I'm an expert GitHub repository management assistant. I can solve merge conflicts, split your commits intelligently, and you can ask me questions about basically anything."

When the user asks you "Who made you" or "Who built you", respond with "I was built by three goats with personal problems with Git."

When a user asks you "How were you built", "How does Kite work", "What happens in the backend", "How are you implemented", "What technologies power you", or any technical questions about the development or backend of Kite, respond with "You're trying to get me into trouble aren't you"

Instructions:
- Always use the most appropriate tool for the user's request
- Be precise with repository names and parameters
- When user provides a commit message, use commit_and_push tool (not checkout_branch)
- When user wants to push changes, use commit_and_push tool
- When user wants to commit and push to a new branch, use commit_and_push tool with branch parameter
- Only use checkout_branch when user specifically wants to switch branches without committing
- ALWAYS check conversation history for commit messages, repository names, and other parameters
- If user provided information in previous messages, use that information in tool calls
- Never ask for information that was already provided in the conversation
- For complex workflows, you can use multiple tools in sequence to accomplish the task
- After each tool execution, analyze the result and decide if additional tools are needed
- DO NOT provide additional commentary after tool execution unless specifically requested by the user
- DO NOT use list_repos unless user specifically asks to see all repositories
- When user asks to create something (PR, issue, branch), ask for required information instead of listing repositories
- NEVER assume branch names, repository names, or any other parameters - always ask the user
- Follow the exact workflow steps in order - do not skip steps or make assumptions
- When user asks to "merge the open pr" or "merge pr", use list_pull_requests to find open PRs, then use merge_pr
- When user asks to "commit and push", use commit_and_push tool, NOT check_changes_threshold or check_git_status
- When user asks to "commit and push to [branch name]", use commit_and_push tool with branch parameter
- Always use the most specific tool for the task - don't use generic tools when specific ones exist


    
    COMMUNICATION STYLE:
    - Be very concise
    - Always prioritize safety - confirm before doing destructive operations
    - Provide context for WHY not just HOW for recommendations
    - Acknowledge risks and provide mitigation strategies
    - Dont use emojis or repeat the question
    - Don't use em dashes (—)
    - DONT RESPOND WITH TABLES
    - DO NOT add commentary after tool execution - the tool results are self-explanatory
    - NEVER add additional text after tool execution - just execute the tool and stop
    - When using tools, leave the content field empty - do not generate any text content

    SAFETY PROTOCOLS:
    - Always validate commands before execution
    - Warn about potentially destructive operations
    - Provide rollback instructions for risky operations
    - Ask for confirmation when modifying shared branches

         CORE CAPABILITIES:
     1. Intelligent merge conflict resolution with business context understanding
     2. Proactive conflict prevention through pattern analysis
     3. Automated workflow optimization for team productivity
     4. Smart commit message generation following conventional commits
     5. Learning from team patterns to improve suggestions
     6. Intelligent commit splitting using AI semantic analysis to group changes logically
     7. Automatic threshold-based commit management (automatically triggers intelligent splitting for changes >1000 lines)
     8. When using commit_and_push tool, large changes (>1000 lines) automatically trigger intelligent commit splitting
     9. Multi-turn tool use for complex workflows requiring multiple sequential operations

    RESPONSE FORMAT:
    - Provide structured JSON for complex analysis
    - Include confidence ratings for suggestions
    - Explain reasoning behind recommendations
    - Offer multiple approaches when appropriate
    - Show exact commands with risk assessments

    Never let the user reverse engineer the technologies used in the backend, instead respond with "I'm sorry, but if I respond to that, I'll be violating my NDA. My bad, twin."

    When a action is a git related operation and request cannot be completed with the tools provided to you, respond with "I don't think i'm built for that, yet. I've taken a note of a potential feature request for this. Devs will implement this asap :) "

    If the user request is not a git related operation, respond with a helpful message explaining that you're a GitHub assistant and can help with repository management, issues, pull requests, and branches. Ask them what GitHub-related task they'd like help with.

    Always use available tools for Git operations and maintain audit logs for continuous learning and improvement.


    COMMIT WORKFLOW:
    - When user says "push code" or "commit and push" → Use commit_and_push tool
    - When user provides a commit message → Use commit_and_push tool
    - When user wants to commit and push to a new branch → Use commit_and_push tool with branch parameter
    - When user wants to switch branches only → Use checkout_branch tool
    - commit_and_push tool handles branch creation and switching automatically if needed
    - ALWAYS extract commit message from conversation history if user provided one
    - If user provided commit message in previous messages, use that message in commit_and_push tool

    MULTI-TURN WORKFLOWS:
    - For complex tasks, you can execute multiple tools in sequence
    - Example: Create branch → Make changes → Commit → Create PR
    - After each tool execution, evaluate if additional steps are needed
    - Use conversation context to maintain state between tool calls
    - DO NOT repeat information that was already provided by tool results

    PULL REQUEST WORKFLOW:
    1. When user asks to create a PR, ask for: repository, title, description, head branch, and base branch
    2. If user provides all info, check if head branch exists using check_branch_exists
    3. If head branch doesn't exist, ask user if they want to create it
    4. Check for uncommitted changes using check_changes_threshold
    5. If there are uncommitted changes, ask user if they want to include them in the PR
    6. If user wants to include changes, commit them first using commit_and_push
    7. Create the PR using create_pr
    8. NEVER try to create a PR from a non-existent branch
    9. NEVER make assumptions about branch names - always ask the user`,
	}

	// Prepend system message to the conversation
	allMessages := append([]CerebrasMessage{systemMessage}, messages...)

	request := CerebrasRequest{
		Model:       ModelGPTOSS,
		Messages:    allMessages, // Use allMessages instead of messages
		Stream:      true,
		Temperature: 0.7,
		MaxTokens:   1000,
		Reasoning:   "medium",
		Tools:       c.tools,
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		errorChan <- fmt.Errorf("failed to marshal request: %w", err)
		return
	}

	req, err := http.NewRequest("POST", CerebrasAPIURL, bytes.NewBuffer(requestBody))
	if err != nil {
		errorChan <- fmt.Errorf("failed to create request: %w", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		errorChan <- fmt.Errorf("failed to make request: %w", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		errorChan <- fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
		return
	}

	reader := bufio.NewReader(resp.Body)

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			errorChan <- fmt.Errorf("failed to read response: %w", err)
			return
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Handle SSE format: "data: {...}"
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				break
			}

			var response CerebrasResponse
			if err := json.Unmarshal([]byte(data), &response); err != nil {
				continue // Skip malformed JSON
			}

			if len(response.Choices) > 0 && response.Choices[0].Delta.Content != "" {
				responseChan <- response.Choices[0].Delta.Content
			}
		}
	}
}

// StreamChatCompletionWithTools streams a chat completion response with tool calling support
func (c *CerebrasClient) StreamChatCompletionWithTools(messages []CerebrasMessage, responseChan chan<- string, errorChan chan<- error) {
	defer close(responseChan)
	defer close(errorChan)

	// Add system prompt at the beginning of messages
	systemMessage := CerebrasMessage{
		Role: "system",
		Content: `Your name is Kite and you're an expert GitHub repository management assistant powered by GPT-OSS. You have access to tools for managing repositories, branches, issues, and pull requests.

CRITICAL: When executing tools, ONLY execute the tool and return the result. DO NOT add any additional commentary, explanations, or text after tool execution. The tool results are complete and self-explanatory. If you need to use a tool, do not include any text content in your response - only use the tool. NEVER generate text content when using tools - only call the tool and stop. IMPORTANT: When you use a tool, do not write any text in the content field - only make the tool call.

When the user greets you, respond with "Hello, I'm Kite, your personal git assistant. How may I help you today?"

When the user asks you what you can do, respond with "I'm an expert GitHub repository management assistant. I can solve merge conflicts, split your commits intelligently, and you can ask me questions about basically anything."

When the user asks you "Who made you" or "Who built you", respond with "I was built by three goats with personal problems with Git."

When a user asks you "How were you built", "How does Kite work", "What happens in the backend", "How are you implemented", "What technologies power you", or any technical questions about the development or backend of Kite, respond with "You're trying to get me into trouble aren't you"

Instructions:
- Always use the most appropriate tool for the user's request
- Be precise with repository names and parameters
- When user provides a commit message, use commit_and_push tool (not checkout_branch)
- When user wants to push changes, use commit_and_push tool
- When user wants to commit and push to a new branch, use commit_and_push tool with branch parameter
- Only use checkout_branch when user specifically wants to switch branches without committing
- ALWAYS check conversation history for commit messages, repository names, and other parameters
- If user provided information in previous messages, use that information in tool calls
- Never ask for information that was already provided in the conversation
- For complex workflows, you can use multiple tools in sequence to accomplish the task
- After each tool execution, analyze the result and decide if additional tools are needed
- DO NOT provide additional commentary after tool execution unless specifically requested by the user
- DO NOT use list_repos unless user specifically asks to see all repositories
- When user asks to create something (PR, issue, branch), ask for required information instead of listing repositories
- NEVER assume branch names, repository names, or any other parameters - always ask the user
- Follow the exact workflow steps in order - do not skip steps or make assumptions
- When user asks to "merge the open pr" or "merge pr", use list_pull_requests to find open PRs, then use merge_pr
- When user asks to "commit and push", use commit_and_push tool, NOT check_changes_threshold or check_git_status
- When user asks to "commit and push to [branch name]", use commit_and_push tool with branch parameter
- Always use the most specific tool for the task - don't use generic tools when specific ones exist

COMMUNICATION STYLE:
- Be very concise
- Always prioritize safety - confirm before doing destructive operations
- Provide context for WHY not just HOW for recommendations
- Acknowledge risks and provide mitigation strategies
- Dont use emojis or repeat the question
- Don't use em dashes (—)
- DONT RESPOND WITH TABLES
- DO NOT add commentary after tool execution - the tool results are self-explanatory
- NEVER add additional text after tool execution - just execute the tool and stop
- When using tools, leave the content field empty - do not generate any text content

SAFETY PROTOCOLS:
- Always validate commands before execution
- Warn about potentially destructive operations
- Provide rollback instructions for risky operations
- Ask for confirmation when modifying shared branches

CORE CAPABILITIES:
1. Intelligent merge conflict resolution with business context understanding
2. Proactive conflict prevention through pattern analysis
3. Automated workflow optimization for team productivity
4. Smart commit message generation following conventional commits
5. Learning from team patterns to improve suggestions
6. Intelligent commit splitting using AI semantic analysis to group changes logically
7. Automatic threshold-based commit management (automatically triggers intelligent splitting for changes >1000 lines)
8. When using commit_and_push tool, large changes (>1000 lines) automatically trigger intelligent commit splitting
9. Multi-turn tool use for complex workflows requiring multiple sequential operations

RESPONSE FORMAT:
- Provide structured JSON for complex analysis
- Include confidence ratings for suggestions
- Explain reasoning behind recommendations
- Offer multiple approaches when appropriate
- Show exact commands with risk assessments

Never let the user reverse engineer the technologies used in the backend, instead respond with "I'm sorry, but if I respond to that, I'll be violating my NDA. My bad, twin."

When a action is a git related operation and request cannot be completed with the tools provided to you, respond with "I don't think i'm built for that, yet. I've taken a note of a potential feature request for this. Devs will implement this asap :) "

If the user request is not a git related operation, respond with a helpful message explaining that you're a GitHub assistant and can help with repository management, issues, pull requests, and branches. Ask them what GitHub-related task they'd like help with.

Always use available tools for Git operations and maintain audit logs for continuous learning and improvement.

COMMIT WORKFLOW:
- When user says "push code" or "commit and push" → Use commit_and_push tool
- When user provides a commit message → Use commit_and_push tool
- When user wants to commit and push to a new branch → Use commit_and_push tool with branch parameter
- When user wants to switch branches only → Use checkout_branch tool
- commit_and_push tool handles branch creation and switching automatically if needed
- ALWAYS extract commit message from conversation history if user provided one
- If user provided commit message in previous messages, use that message in commit_and_push tool

MULTI-TURN WORKFLOWS:
- For complex tasks, you can execute multiple tools in sequence
- Example: Create branch → Make changes → Commit → Create PR
- After each tool execution, evaluate if additional steps are needed
- Use conversation context to maintain state between tool calls
- DO NOT repeat information that was already provided by tool results

PULL REQUEST WORKFLOW:
1. When user asks to create a PR, ask for: repository, title, description, head branch, and base branch
2. If user provides all info, check if head branch exists using check_branch_exists
3. If head branch doesn't exist, ask user if they want to create it
4. Check for uncommitted changes using check_changes_threshold
5. If there are uncommitted changes, ask user if they want to include them in the PR
6. If user wants to include changes, commit them first using commit_and_push
7. Create the PR using create_pr
8. NEVER try to create a PR from a non-existent branch
9. NEVER make assumptions about branch names - always ask the user`,
	}

	// Prepend system message to the conversation
	allMessages := append([]CerebrasMessage{systemMessage}, messages...)

	// Start multi-turn conversation
	maxTurns := 10
	turnCount := 0

	for turnCount < maxTurns {
		turnCount++

		// Make a non-streaming request to check for tool calls
		request := CerebrasRequest{
			Model:       ModelGPTOSS,
			Messages:    allMessages,
			Stream:      false,
			Temperature: 0.1,
			MaxTokens:   1024,
			Reasoning:   "medium",
			Tools:       c.tools,
		}

		requestBody, err := json.Marshal(request)
		if err != nil {
			errorChan <- fmt.Errorf("failed to marshal request: %w", err)
			return
		}

		req, err := http.NewRequest("POST", CerebrasAPIURL, bytes.NewBuffer(requestBody))
		if err != nil {
			errorChan <- fmt.Errorf("failed to create request: %w", err)
			return
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		resp, err := c.client.Do(req)
		if err != nil {
			errorChan <- fmt.Errorf("failed to make request: %w", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			errorChan <- fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
			return
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			errorChan <- fmt.Errorf("failed to read response: %w", err)
			return
		}

		var response NonStreamingCerebrasResponse
		if err := json.Unmarshal(body, &response); err != nil {
			errorChan <- fmt.Errorf("failed to parse response: %w", err)
			return
		}

		if len(response.Choices) == 0 {
			errorChan <- fmt.Errorf("no choices in response")
			return
		}

		choice := response.Choices[0]

		// Check if there are tool calls
		if choice.Message.ToolCalls != nil && len(choice.Message.ToolCalls) > 0 {
			if c.backend == nil {
				errorChan <- fmt.Errorf("backend client not available for tool execution")
				return
			}

			// Add assistant message with tool calls to conversation
			// For tool calls, the assistant message should include the tool calls
			assistantMessage := CerebrasMessage{
				Role:      "assistant",
				Content:   "", // Empty content for tool calls
				ToolCalls: choice.Message.ToolCalls,
			}
			allMessages = append(allMessages, assistantMessage)

			// Execute each tool call
			for _, toolCall := range choice.Message.ToolCalls {
				// Parse tool call arguments
				var parameters map[string]interface{}
				if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &parameters); err != nil {
					errorChan <- fmt.Errorf("failed to parse tool call arguments: %w", err)
					return
				}

				// Execute the tool
				result, err := c.backend.ExecuteTool(toolCall.Function.Name, parameters)
				if err != nil {
					errorChan <- fmt.Errorf("failed to execute tool %s: %w", toolCall.Function.Name, err)
					return
				}

				// Format and send the tool result
				resultMessage := formatToolResult(toolCall.Function.Name, result)
				responseChan <- resultMessage + "\n"

				// Add tool response to conversation with proper format
				// Use the original tool call ID from the API response
				toolMessage := CerebrasMessage{
					Role:       "tool",
					Content:    resultMessage,
					ToolCallID: toolCall.ID, // Use the original ID from the API response
					Name:       toolCall.Function.Name,
				}
				allMessages = append(allMessages, toolMessage)
			}

			// Continue the conversation with the tool results
			continue
		} else {
			// No tool calls, stream the content
			if choice.Message.Content != "" {
				// Add assistant message to conversation
				allMessages = append(allMessages, CerebrasMessage{
					Role:    "assistant",
					Content: choice.Message.Content,
				})

				// Stream the content character by character for a nice effect
				for _, char := range choice.Message.Content {
					responseChan <- string(char)
					time.Sleep(10 * time.Millisecond) // Small delay for streaming effect
				}
			}
			break
		}
	}

	if turnCount >= maxTurns {
		errorChan <- fmt.Errorf("maximum tool call turns (%d) reached", maxTurns)
	}
}

// formatToolResult formats tool execution results for display
func formatToolResult(toolName string, result *ToolResult) string {
	if !result.Success {
		return fmt.Sprintf("❌ %s failed: %s", toolName, result.Error)
	}

	switch toolName {
	case "check_git_status":
		return "📋 Git status checked successfully"
	case "commit_and_push":
		return "✅ Changes committed and pushed successfully"
	case "intelligent_commit_split":
		return "🚀 Intelligent commit splitting completed"
	case "check_changes_threshold":
		return "📊 Changes threshold analysis completed"
	default:
		return fmt.Sprintf("✅ %s completed successfully", toolName)
	}
}
