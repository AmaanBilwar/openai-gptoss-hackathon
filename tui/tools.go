package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Tool definitions based on the TypeScript backend
type ToolDefinition struct {
	Type     string `json:"type"`
	Function struct {
		Name        string                 `json:"name"`
		Description string                 `json:"description"`
		Parameters  map[string]interface{} `json:"parameters"`
	} `json:"function"`
}

// ToolCall represents a tool call request
type ToolCall struct {
	Tool       string                 `json:"tool"`
	Parameters map[string]interface{} `json:"parameters"`
}

// ToolResult represents the result of a tool execution
type ToolResult struct {
	Success          bool                   `json:"success"`
	Error            string                 `json:"error,omitempty"`
	Suggestion       string                 `json:"suggestion,omitempty"`
	Data             map[string]interface{} `json:"data,omitempty"`
	ProgressMessages []string               `json:"progress_messages,omitempty"`
}

// BackendClient handles communication with the TypeScript backend
type BackendClient struct {
	baseURL string
	client  *http.Client
}

// NewBackendClient creates a new backend client
func NewBackendClient() (*BackendClient, error) {
	baseURL := os.Getenv("BACKEND_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3001" // Default backend URL
	}

	return &BackendClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// GetTools returns all available tools
func GetTools() []ToolDefinition {
	return []ToolDefinition{
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "list_repos",
				Description: "List all repositories for the authenticated user.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
					"required":   []string{},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "list_pull_requests",
				Description: "List pull requests for a given repository. Can filter by state (open, closed, or all).",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"state": map[string]interface{}{
							"type":        "string",
							"description": "Filter pull requests by state (open, closed, or all)",
							"enum":        []string{"open", "closed", "all"},
						},
					},
					"required": []string{"repo"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "get_pull_request",
				Description: "Get details of a specific pull request by number.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"pull_number": map[string]interface{}{
							"type":        "integer",
							"description": "The pull request number to retrieve",
						},
					},
					"required": []string{"repo", "pull_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "update_pull_request",
				Description: "Update an existing pull request with new title, body, state, or base branch.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"pull_number": map[string]interface{}{
							"type":        "integer",
							"description": "The pull request number to update",
						},
						"title": map[string]interface{}{
							"type":        "string",
							"description": "New title for the pull request",
						},
						"body": map[string]interface{}{
							"type":        "string",
							"description": "New body/description for the pull request",
						},
						"state": map[string]interface{}{
							"type":        "string",
							"description": "State of the pull request (open or closed)",
							"enum":        []string{"open", "closed"},
						},
						"base": map[string]interface{}{
							"type":        "string",
							"description": "New base branch for the pull request",
						},
					},
					"required": []string{"repo", "pull_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "list_pull_request_commits",
				Description: "List all commits on a pull request.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"pull_number": map[string]interface{}{
							"type":        "integer",
							"description": "The pull request number",
						},
						"per_page": map[string]interface{}{
							"type":        "integer",
							"description": "Number of commits per page (default: 100)",
						},
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Page number (default: 1)",
						},
					},
					"required": []string{"repo", "pull_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "list_pull_request_files",
				Description: "List all files changed in a pull request.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"pull_number": map[string]interface{}{
							"type":        "integer",
							"description": "The pull request number",
						},
						"per_page": map[string]interface{}{
							"type":        "integer",
							"description": "Number of files per page (default: 100)",
						},
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Page number (default: 1)",
						},
					},
					"required": []string{"repo", "pull_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "check_pull_request_merged",
				Description: "Check if a pull request has been merged.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"pull_number": map[string]interface{}{
							"type":        "integer",
							"description": "The pull request number to check",
						},
					},
					"required": []string{"repo", "pull_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "update_pull_request_branch",
				Description: "Update a pull request branch with the latest upstream changes by merging HEAD from the base branch.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"pull_number": map[string]interface{}{
							"type":        "integer",
							"description": "The pull request number",
						},
						"expected_head_sha": map[string]interface{}{
							"type":        "string",
							"description": "The expected SHA of the pull request's HEAD ref (optional)",
						},
					},
					"required": []string{"repo", "pull_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "checkout_branch",
				Description: "Switch to a different branch in a repository. Use this when you want to change branches without committing changes.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"branch": map[string]interface{}{
							"type":        "string",
							"description": "The name of the branch to checkout",
						},
					},
					"required": []string{"repo", "branch"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "create_pr",
				Description: "Create a pull request for a given repository. ONLY use this after confirming: 1) Head branch exists, 2) User has provided all required info (repo, title, description, head, base), 3) Any uncommitted changes have been handled. NEVER assume branch names - always get them from user.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"title": map[string]interface{}{
							"type":        "string",
							"description": "The title of the pull request",
						},
						"body": map[string]interface{}{
							"type":        "string",
							"description": "The body of the pull request",
						},
						"head": map[string]interface{}{
							"type":        "string",
							"description": "The head branch (defaults to 'feature-branch')",
						},
						"base": map[string]interface{}{
							"type":        "string",
							"description": "The base branch (defaults to 'main')",
						},
					},
					"required": []string{"repo", "title", "body"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "create_issue",
				Description: "Create an issue for a given repository.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"title": map[string]interface{}{
							"type":        "string",
							"description": "The title of the issue",
						},
						"body": map[string]interface{}{
							"type":        "string",
							"description": "The body of the issue",
						},
					},
					"required": []string{"repo", "title", "body"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "create_branch",
				Description: "Create a new branch in a GitHub repository.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"branch": map[string]interface{}{
							"type":        "string",
							"description": "The name for the new branch",
						},
						"from_branch": map[string]interface{}{
							"type":        "string",
							"description": "The base branch to branch from (defaults to repo's default)",
						},
					},
					"required": []string{"repo", "branch"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "list_issues",
				Description: "List all issues for a repository.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
					},
					"required": []string{"repo"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "get_issue",
				Description: "Get a specific issue by number.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"issue_number": map[string]interface{}{
							"type":        "integer",
							"description": "The issue number to retrieve",
						},
					},
					"required": []string{"repo", "issue_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "update_issue",
				Description: "Update an existing issue.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"issue_number": map[string]interface{}{
							"type":        "integer",
							"description": "The issue number to update",
						},
						"title": map[string]interface{}{
							"type":        "string",
							"description": "New title for the issue",
						},
						"body": map[string]interface{}{
							"type":        "string",
							"description": "New body/description for the issue",
						},
						"state": map[string]interface{}{
							"type":        "string",
							"description": "State of the issue (open or closed)",
							"enum":        []string{"open", "closed"},
						},
					},
					"required": []string{"repo", "issue_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "merge_pr",
				Description: "Merge a pull request. Use this when user asks to merge a PR. You need the repository name and pull request number.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"pull_number": map[string]interface{}{
							"type":        "integer",
							"description": "The pull request number to merge",
						},
						"commit_title": map[string]interface{}{
							"type":        "string",
							"description": "Title for the merge commit",
						},
						"commit_message": map[string]interface{}{
							"type":        "string",
							"description": "Message to append to the merge commit",
						},
						"merge_method": map[string]interface{}{
							"type":        "string",
							"description": "Merge method to use",
							"enum":        []string{"merge", "squash", "rebase"},
						},
					},
					"required": []string{"repo", "pull_number"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "intelligent_commit_split",
				Description: "This is the PRIMARY tool for committing code. Intelligently split uncommitted changes into logical commits using AI analysis. This tool analyzes file changes semantically and groups them into meaningful commits with proper conventional commit messages. Use this when user wants to commit changes. ALWAYS check conversation history for commit message if user provided one. Includes automatic threshold checking and intelligent commit splitting for large changes. If a branch parameter is provided, it will create and switch to that branch before committing. NOTE: Only pushes to remote if user explicitly mentions 'push' - otherwise only commits locally.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"auto_push": map[string]interface{}{
							"type":        "boolean",
							"description": "Whether to automatically push the commits after splitting (default: false)",
						},
						"dry_run": map[string]interface{}{
							"type":        "boolean",
							"description": "Whether to only analyze and show what would be done without actually creating commits (default: false)",
						},
						"commit_message": map[string]interface{}{
							"type":        "string",
							"description": "The commit message to use (optional - if not provided, intelligent commit splitting will generate appropriate messages)",
						},
						"branch": map[string]interface{}{
							"type":        "string",
							"description": "The branch to create and switch to before committing (optional, uses current branch if not specified)",
						},
						"files": map[string]interface{}{
							"type": "array",
							"items": map[string]interface{}{
								"type": "string",
							},
							"description": "List of specific files to commit (optional, commits all changes if not specified)",
						},
						"force_intelligent_split": map[string]interface{}{
							"type":        "boolean",
							"description": "Force intelligent commit splitting even for small changes (default: false)",
						},
					},
					"required": []string{},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "push_to_remote",
				Description: "Push the current branch to the remote repository. Use this when user asks to push code / commits to remote.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
					"required":   []string{},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "check_changes_threshold",
				Description: "Check if uncommitted changes exceed the threshold (1000 lines) and return analysis of changes.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"threshold": map[string]interface{}{
							"type":        "integer",
							"description": "Line threshold to check against (default: 1000)",
						},
					},
					"required": []string{},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "check_git_status",
				Description: "Check the current git status including current branch, uncommitted changes, and remote status. Use this to understand the repository state before making changes.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
					"required":   []string{},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "check_branch_exists",
				Description: "Check if a specific branch exists in the repository. Use this before creating PRs to ensure the head branch exists.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"branch": map[string]interface{}{
							"type":        "string",
							"description": "The branch name to check",
						},
					},
					"required": []string{"repo", "branch"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "list_repository_commits",
				Description: "List recent commits in a repository. Use this to see commit history, latest commits, or specific branch commits.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format",
						},
						"branch": map[string]interface{}{
							"type":        "string",
							"description": "The branch to list commits from (default: main)",
						},
						"per_page": map[string]interface{}{
							"type":        "integer",
							"description": "Number of commits to return (default: 10, max: 100)",
						},
					},
					"required": []string{"repo"},
				},
			},
		},
		{
			Type: "function",
			Function: struct {
				Name        string                 `json:"name"`
				Description string                 `json:"description"`
				Parameters  map[string]interface{} `json:"parameters"`
			}{
				Name:        "resolve_merge_conflicts",
				Description: "Resolve merge conflicts in a specific file or all files under a path. Auto-detects current repository if not specified.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"repo": map[string]interface{}{
							"type":        "string",
							"description": "The repository name in 'owner/repo' format (optional, auto-detected from current directory)",
						},
						"path": map[string]interface{}{
							"type":        "string",
							"description": "File or directory to resolve merge conflicts in (defaults to current directory)",
						},
						"preview_only": map[string]interface{}{
							"type":        "boolean",
							"description": "If true, do not write files; just compute resolutions",
						},
						"explain": map[string]interface{}{
							"type":        "boolean",
							"description": "If true, print concise LLM rationales for each resolved conflict",
						},
					},
					"required": []string{},
				},
			},
		},
	}
}

// ExecuteTool calls the TypeScript backend to execute a tool
func (bc *BackendClient) ExecuteTool(toolName string, parameters map[string]interface{}) (*ToolResult, error) {
	// Create the tool call request
	toolCall := ToolCall{
		Tool:       toolName,
		Parameters: parameters,
	}

	// Marshal the request
	requestBody, err := json.Marshal(toolCall)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tool call: %w", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("%s/api/tools/execute", bc.baseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Make the request
	resp, err := bc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute tool: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tool execution failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result ToolResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// IsGitAction checks if a tool call is a git-related action
func IsGitAction(toolName string) bool {
	gitTools := map[string]bool{
		"checkout_branch":          true,
		"create_branch":            true,
		"intelligent_commit_split": true,
		"push_to_remote":           true,
		"check_changes_threshold":  true,
		"check_git_status":         true,
		"check_branch_exists":      true,
		"list_repository_commits":  true,
		"resolve_merge_conflicts":  true,
	}
	return gitTools[toolName]
}
