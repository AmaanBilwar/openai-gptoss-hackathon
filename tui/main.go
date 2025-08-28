package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const gap = "\n\n"

// Available spinners
var spinners = []spinner.Spinner{
	spinner.Points,
}

// Simple markdown renderer for CLI responses
func renderMarkdown(content string) string {
	if content == "" {
		return content
	}

	// Simple markdown parsing for common elements
	lines := strings.Split(content, "\n")
	var result []string

	for _, line := range lines {
		// Handle headers
		if strings.HasPrefix(line, "# ") {
			title := strings.TrimPrefix(line, "# ")
			result = append(result, lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("69")).Render(title))
		} else if strings.HasPrefix(line, "## ") {
			title := strings.TrimPrefix(line, "## ")
			result = append(result, lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("252")).Render(title))
		} else if strings.HasPrefix(line, "### ") {
			title := strings.TrimPrefix(line, "### ")
			result = append(result, lipgloss.NewStyle().Bold(true).Render(title))
		} else if strings.HasPrefix(line, "**") && strings.HasSuffix(line, "**") {
			// Bold text
			boldText := strings.TrimPrefix(strings.TrimSuffix(line, "**"), "**")
			result = append(result, lipgloss.NewStyle().Bold(true).Render(boldText))
		} else if strings.HasPrefix(line, "* ") {
			// Bullet points
			bullet := strings.TrimPrefix(line, "* ")
			result = append(result, "• "+bullet)
		} else if strings.HasPrefix(line, "- ") {
			// Bullet points
			bullet := strings.TrimPrefix(line, "- ")
			result = append(result, "• "+bullet)
		} else if strings.Contains(line, "🔐") || strings.Contains(line, "✅") || strings.Contains(line, "⏳") {
			// Emoji lines - keep as is
			result = append(result, line)
		} else {
			// Regular text
			result = append(result, line)
		}
	}

	return strings.Join(result, "\n")
}

// renderMarkdownWithWidth renders markdown content with a specific width
func renderMarkdownWithWidth(content string, width int) string {
	// For now, use the same renderer but with word wrapping
	rendered := renderMarkdown(content)

	// Simple word wrapping
	lines := strings.Split(rendered, "\n")
	var wrappedLines []string

	for _, line := range lines {
		if len(line) <= width {
			wrappedLines = append(wrappedLines, line)
		} else {
			// Simple word wrap
			words := strings.Fields(line)
			currentLine := ""

			for _, word := range words {
				if len(currentLine)+len(word)+1 <= width {
					if currentLine != "" {
						currentLine += " " + word
					} else {
						currentLine = word
					}
				} else {
					if currentLine != "" {
						wrappedLines = append(wrappedLines, currentLine)
					}
					currentLine = word
				}
			}

			if currentLine != "" {
				wrappedLines = append(wrappedLines, currentLine)
			}
		}
	}

	return strings.Join(wrappedLines, "\n")
}

var (
	textStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("252"))
	spinnerStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("69"))
	// helpStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
)

func main() {
	// Check if we're running in test mode
	if len(os.Args) > 1 && os.Args[1] == "test" {
		testToolCalling()
		return
	}

	p := tea.NewProgram(initialModel(), tea.WithAltScreen())

	if _, err := p.Run(); err != nil {
		log.Fatal(err)
	}
}

func testToolCalling() {
	fmt.Println("Testing Kite Go CLI Tool Calling...")

	// Test backend client initialization
	_, err := NewBackendClient()
	if err != nil {
		log.Printf("Failed to initialize backend client: %v", err)
	} else {
		fmt.Println("✅ Backend client initialized successfully")
	}

	// Test tools definition
	tools := GetTools()
	fmt.Printf("✅ Loaded %d tools\n", len(tools))

	// Test git action detection
	testTools := []string{
		"checkout_branch",
		"commit_and_push",
		"create_pr",
		"list_repos",
		"get_issue",
	}

	for _, tool := range testTools {
		isGit := IsGitAction(tool)
		fmt.Printf("Tool '%s': Git action = %t\n", tool, isGit)
	}

	// Test Cerebras client initialization
	cerebras, err := NewCerebrasClient()
	if err != nil {
		log.Printf("Failed to initialize Cerebras client: %v", err)
		fmt.Println("⚠️  Cerebras client not available (check CEREBRAS_API_KEY)")
	} else {
		fmt.Println("✅ Cerebras client initialized successfully")
		if cerebras.backend != nil {
			fmt.Println("✅ Backend integration available")
		} else {
			fmt.Println("⚠️  Backend integration not available")
		}
	}

	fmt.Println("\n🎉 Tool calling setup complete!")
	fmt.Println("\nTo test the full functionality:")
	fmt.Println("1. Start the TypeScript backend: cd ../kite && npm run dev")
	fmt.Println("2. Set your CEREBRAS_API_KEY environment variable")
	fmt.Println("3. Run: go run .")
}

type (
	errMsg error
)

type model struct {
	viewport        viewport.Model
	messages        []string
	textarea        textarea.Model
	senderStyle     lipgloss.Style
	err             error
	spinner         spinner.Model
	spinnerIdx      int
	isSpinning      bool
	spinnerMsg      string
	cerebras        *CerebrasClient
	auth            *AuthClient
	chatHistory     []CerebrasMessage
	currentResponse string
	isStreaming     bool
	responseChan    <-chan string
	errorChan       <-chan error
}

func initialModel() model {
	ta := textarea.New()
	ta.Placeholder = "Send a message..."
	ta.Focus()

	ta.Prompt = ">> "
	ta.CharLimit = 280

	ta.SetWidth(30)
	ta.SetHeight(1)

	// Remove cursor line styling
	ta.FocusedStyle.CursorLine = lipgloss.NewStyle()

	ta.ShowLineNumbers = false

	vp := viewport.New(30, 5)
	welcomeMessage := `# Welcome to Kite - Your Personal Git Assistant!

Type a message and press **Enter** to send.`
	renderedWelcome := renderMarkdown(welcomeMessage)
	vp.SetContent(renderedWelcome)
	vp.Style = lipgloss.NewStyle().BorderStyle(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("240"))

	ta.KeyMap.InsertNewline.SetEnabled(false)

	// Initialize spinner
	s := spinner.New()
	s.Style = spinnerStyle
	s.Spinner = spinners[0]

	// Initialize Cerebras client
	cerebras, err := NewCerebrasClient()
	if err != nil {
		log.Printf("Warning: Failed to initialize Cerebras client: %v", err)
	}

	// Initialize auth client
	auth := NewAuthClient()

	return model{
		textarea:        ta,
		messages:        []string{},
		viewport:        vp,
		senderStyle:     lipgloss.NewStyle().Foreground(lipgloss.Color("5")),
		err:             nil,
		spinner:         s,
		spinnerIdx:      0,
		isSpinning:      false,
		spinnerMsg:      "",
		cerebras:        cerebras,
		auth:            auth,
		chatHistory:     []CerebrasMessage{},
		currentResponse: "",
		isStreaming:     false,
		responseChan:    nil,
		errorChan:       nil,
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		textarea.Blink,
		m.spinner.Tick,
		tea.SetWindowTitle("Kite - Your Personal Git Assistant"),
		m.checkAuthOnStartup(),
	)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var (
		tiCmd tea.Cmd
		vpCmd tea.Cmd
		spCmd tea.Cmd
	)

	m.textarea, tiCmd = m.textarea.Update(msg)
	m.viewport, vpCmd = m.viewport.Update(msg)
	m.spinner, spCmd = m.spinner.Update(msg)

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.viewport.Width = msg.Width
		m.textarea.SetWidth(msg.Width)
		// Calculate viewport height with proper spacing
		textareaHeight := m.textarea.Height()
		gapHeight := lipgloss.Height(gap)
		m.viewport.Height = msg.Height - textareaHeight - gapHeight - 2 // Extra margin

		if len(m.messages) > 0 {
			// Join messages and render markdown for the entire content
			content := strings.Join(m.messages, "\n")
			// Apply width constraint to prevent overflow and ensure clean rendering
			styledContent := lipgloss.NewStyle().
				Width(m.viewport.Width - 4).
				Height(m.viewport.Height).
				Render(content)
			m.viewport.SetContent(styledContent)
		}
		m.viewport.GotoBottom()
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC, tea.KeyEsc:
			fmt.Println(m.textarea.Value())
			return m, tea.Quit
		case tea.KeyEnter:
			if m.isStreaming {
				// Don't allow new messages while streaming
				return m, nil
			}

			message := m.textarea.Value()
			if message == "" {
				return m, nil
			}

			m.messages = append(m.messages, m.senderStyle.Render("You: ")+message)

			// Add user message to chat history
			m.chatHistory = append(m.chatHistory, CerebrasMessage{
				Role:    "user",
				Content: message,
			})

			// Start streaming response
			if m.cerebras != nil {
				m.startSpinner("Kite is cooking...")
				m.isStreaming = true
				m.currentResponse = ""
				// Add empty bot message that will be filled with streaming content
				m.messages = append(m.messages, textStyle.Render("Bot: "))

				return m, m.makeAPIRequest()
			} else {
				// Fallback if Cerebras client is not available
				m.startSpinner("Cerebras client not available...")
				return m, tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
					return spinnerCompleteMsg{response: "**Error:** Cerebras client not initialized. Please check your `CEREBRAS_API_KEY` environment variable."}
				})
			}
		}
	case spinnerCompleteMsg:
		m.stopSpinner()
		// Render markdown for the bot response
		renderedResponse := renderMarkdown(msg.response)
		m.messages = append(m.messages, textStyle.Render("Bot: ")+renderedResponse)
		styledContent := lipgloss.NewStyle().
			Width(m.viewport.Width - 4).
			Height(m.viewport.Height).
			Render(strings.Join(m.messages, "\n"))
		m.viewport.SetContent(styledContent)
		m.textarea.Reset()
		m.viewport.GotoBottom()
		return m, nil

	case streamingChunkMsg:
		// Update the current response with the new chunk
		m.currentResponse += msg.chunk

		// Update the last message with the current streaming content (render markdown)
		if len(m.messages) > 0 {
			renderedResponse := renderMarkdownWithWidth(m.currentResponse, m.viewport.Width)
			m.messages[len(m.messages)-1] = textStyle.Render("Bot: ") + renderedResponse
			styledContent := lipgloss.NewStyle().
				Width(m.viewport.Width - 4).
				Height(m.viewport.Height).
				Render(strings.Join(m.messages, "\n"))
			m.viewport.SetContent(styledContent)
			m.viewport.GotoBottom()
		}

		// Continue listening for more chunks using stored channels
		return m, m.handleStreaming(m.responseChan, m.errorChan)

	case startStreamingMsg:
		// Store the channels in the model
		m.responseChan = msg.responseChan
		m.errorChan = msg.errorChan
		// Start the streaming
		return m, m.handleStreaming(msg.responseChan, msg.errorChan)

	case apiResponseMsg:
		m.isStreaming = false
		m.stopSpinner()
		// Clear the channels
		m.responseChan = nil
		m.errorChan = nil

		// Add assistant message to chat history
		if msg.response != "" {
			m.chatHistory = append(m.chatHistory, CerebrasMessage{
				Role:    "assistant",
				Content: msg.response,
			})
		}

		// Update the last message with the full response (render markdown)
		if len(m.messages) > 0 {
			renderedResponse := renderMarkdownWithWidth(msg.response, m.viewport.Width)
			m.messages[len(m.messages)-1] = textStyle.Render("Bot: ") + renderedResponse
			styledContent := lipgloss.NewStyle().
				Width(m.viewport.Width - 4).
				Height(m.viewport.Height).
				Render(strings.Join(m.messages, "\n"))
			m.viewport.SetContent(styledContent)
			m.viewport.GotoBottom()
		}

		m.textarea.Reset()
		return m, nil

	case authRequiredMsg:
		m.isStreaming = false
		m.stopSpinner()
		// Clear the channels
		m.responseChan = nil
		m.errorChan = nil

		// Show authentication message
		authMessage := "🔐 **You are not authenticated.** Let's authenticate you first!\n\nI'll open your browser to complete the authentication process."
		renderedAuth := renderMarkdown(authMessage)
		m.messages = append(m.messages, textStyle.Render("Bot: ")+renderedAuth)
		styledContent := lipgloss.NewStyle().
			Width(m.viewport.Width - 4).
			Height(m.viewport.Height).
			Render(strings.Join(m.messages, "\n"))
		m.viewport.SetContent(styledContent)
		m.viewport.GotoBottom()

		// Start authentication flow
		return m, m.startAuthFlow()

	case authCompleteMsg:
		// Authentication completed, show success message
		successMessage := "✅ **Authentication completed successfully!**\n\nYou can now continue using Kite with all features."
		renderedSuccess := renderMarkdown(successMessage)
		m.messages = append(m.messages, textStyle.Render("Bot: ")+renderedSuccess)
		styledContent := lipgloss.NewStyle().
			Width(m.viewport.Width - 4).
			Height(m.viewport.Height).
			Render(strings.Join(m.messages, "\n"))
		m.viewport.SetContent(styledContent)
		m.textarea.Reset()
		m.viewport.GotoBottom()
		return m, nil

	case apiErrorMsg:
		m.isStreaming = false
		m.stopSpinner()
		// Clear the channels
		m.responseChan = nil
		m.errorChan = nil
		// Render error message as markdown (in case it contains formatting)
		renderedError := renderMarkdown("Error: " + msg.error)
		m.messages = append(m.messages, textStyle.Render("Bot: ")+renderedError)
		styledContent := lipgloss.NewStyle().
			Width(m.viewport.Width - 4).
			Height(m.viewport.Height).
			Render(strings.Join(m.messages, "\n"))
		m.viewport.SetContent(styledContent)
		m.textarea.Reset()
		m.viewport.GotoBottom()
		return m, nil

	// We handle errors just like any other message
	case errMsg:
		m.err = msg
		return m, nil
	}

	return m, tea.Batch(tiCmd, vpCmd, spCmd)
}

func (m *model) makeAPIRequest() tea.Cmd {
	return func() tea.Msg {
		// Check authentication first
		if m.auth != nil {
			authenticated, err := m.auth.CheckAuthStatus()
			if err != nil {
				return apiErrorMsg{error: fmt.Sprintf("Failed to check authentication status: %v", err)}
			}

			if !authenticated {
				// Return a special message to trigger auth flow
				return authRequiredMsg{}
			}
		}

		// Create channels for the API call
		responseChan := make(chan string)
		errorChan := make(chan error)

		// Start the API call in a goroutine
		go func() {
			// Use tool calling if backend is available, otherwise fall back to regular chat
			if m.cerebras.backend != nil {
				m.cerebras.StreamChatCompletionWithTools(m.chatHistory, responseChan, errorChan)
			} else {
				m.cerebras.StreamChatCompletion(m.chatHistory, responseChan, errorChan)
			}
		}()

		// Return a command that will handle streaming
		return startStreamingMsg{
			responseChan: responseChan,
			errorChan:    errorChan,
		}
	}
}

func (m *model) handleStreaming(responseChan <-chan string, errorChan <-chan error) tea.Cmd {
	return func() tea.Msg {
		select {
		case content, ok := <-responseChan:
			if !ok {
				// Response channel closed, finish streaming
				if m.currentResponse != "" {
					return apiResponseMsg{response: m.currentResponse}
				} else {
					// Check error channel
					select {
					case err, ok := <-errorChan:
						if ok {
							return apiErrorMsg{error: err.Error()}
						}
					default:
					}
					return apiErrorMsg{error: "No response received"}
				}
			}
			// Send the chunk for immediate display
			return streamingChunkMsg{chunk: content}
		case err, ok := <-errorChan:
			if !ok {
				// Error channel closed, check if we have a response
				if m.currentResponse != "" {
					return apiResponseMsg{response: m.currentResponse}
				}
				return apiErrorMsg{error: "No response received"}
			}
			return apiErrorMsg{error: err.Error()}
		}
	}
}

func (m *model) startSpinner(message string) {
	m.isSpinning = true
	m.spinnerMsg = message
	// Cycle to next spinner
	m.spinnerIdx = (m.spinnerIdx + 1) % len(spinners)
	m.spinner.Spinner = spinners[m.spinnerIdx]
}

func (m *model) stopSpinner() {
	m.isSpinning = false
	m.spinnerMsg = ""
}

func (m *model) checkAuthOnStartup() tea.Cmd {
	return func() tea.Msg {
		// Check authentication status on startup
		if m.auth != nil {
			authenticated, err := m.auth.CheckAuthStatus()
			if err != nil {
				// Log error but don't show to user yet
				log.Printf("Failed to check auth status on startup: %v", err)
				return nil
			}

			if !authenticated {
				// Return auth required message to trigger auth flow
				return authRequiredMsg{}
			}
		}
		return nil
	}
}

func (m *model) startAuthFlow() tea.Cmd {
	return func() tea.Msg {
		// Start authentication in a goroutine
		go func() {
			if m.auth != nil {
				if err := m.auth.StartAuthFlow(); err != nil {
					// Send error message back to the UI
					// We'll handle this by updating the UI directly
					fmt.Printf("Authentication failed: %v\n", err)
				} else {
					// Authentication successful, update the UI
					fmt.Println("✅ Authentication completed successfully!")
				}
			}
		}()

		// Return a command that will show a waiting message
		return tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
			return authCompleteMsg{}
		})
	}
}

func (m model) View() string {
	content := m.viewport.View()

	// Add spinner if active
	if m.isSpinning {
		spinnerContent := fmt.Sprintf("\n %s %s", m.spinner.View(), textStyle.Render(m.spinnerMsg))
		content += spinnerContent
	}

	// Ensure proper spacing and prevent overlapping
	return lipgloss.NewStyle().
		Margin(0, 1).
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		Render(fmt.Sprintf(
			"%s%s%s",
			content,
			gap,
			m.textarea.View(),
		))
}

// Custom message types
type spinnerCompleteMsg struct {
	response string
}

type apiResponseMsg struct {
	response string
}

type authRequiredMsg struct{}

type authCompleteMsg struct{}

type apiErrorMsg struct {
	error string
}

type streamingChunkMsg struct {
	chunk string
}

type startStreamingMsg struct {
	responseChan <-chan string
	errorChan    <-chan error
}
