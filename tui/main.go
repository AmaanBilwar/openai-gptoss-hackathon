package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/lipgloss"
)

const gap = "\n\n"

// Available spinners
var spinners = []spinner.Spinner{
	spinner.Points,
}

// keyMap defines a set of keybindings for the help system
type keyMap struct {
	Up    key.Binding
	Down  key.Binding
	Quit  key.Binding
	Clear key.Binding
}

// ShortHelp returns keybindings to be shown in the mini help view
func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Quit}
}

// FullHelp returns keybindings for the expanded help view
func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down}, // first column
		{k.Quit},       // second column
		{k.Clear},      // third column
	}
}

var keys = keyMap{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "scroll up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "scroll down"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q", "esc", "ctrl+c"),
		key.WithHelp("q", "quit"),
	),
	Clear: key.NewBinding(
		key.WithKeys("ctrl+l"),
		key.WithHelp("ctrl+l", "clear chat"),
	),
}

// helpText provides comprehensive help information
var helpText = `# Kite - Your Personal Git Assistant

## Quick Commands
- **?** or **/help** - Show this help
- **/clear** - Clear chat history
- **/history** - View your chat history
- **Ctrl+L** - Clear chat (keyboard shortcut)
- **exit** or **quit** - Exit the application

## Navigation
- **↑/k** - Scroll up in chat
- **↓/j** - Scroll down in chat
- **Enter** - Send message
- **Esc** or **Ctrl+C** - Quit application

## What I Can Do
I'm an expert GitHub repository management assistant. I can help you with:

### Git Operations
- Commit and push changes
- Create and switch branches
- Resolve merge conflicts
- Intelligent commit splitting

### GitHub Management
- Create pull requests
- Manage issues
- List repositories
- Check repository status

### Smart Features
- Automatic conflict detection
- Intelligent commit message generation
- Workflow optimization
- Team pattern learning

## Getting Started
1. **Authentication**: I'll help you authenticate with GitHub
2. **Ask Questions**: Just type your Git-related questions
3. **Use Commands**: Try "commit and push" or "create a PR"

## Examples
- "Commit and push my changes"
- "Create a new branch called feature-x"
- "Show me the open pull requests"
- "Help me resolve this merge conflict"

*Type ? anytime to see this help again!*`

// Glamour markdown renderer for CLI responses
func renderMarkdown(content string) string {
	if content == "" {
		return content
	}

	// Create a custom renderer with dark theme and proper width handling
	r, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(80),
	)
	if err != nil {
		// Fallback to simple rendering if Glamour fails
		return content
	}

	out, err := r.Render(content)
	if err != nil {
		// Fallback to simple rendering if Glamour fails
		return content
	}

	return out
}

// renderMarkdownWithWidth renders markdown content with a specific width
func renderMarkdownWithWidth(content string, width int) string {
	if content == "" {
		return content
	}

	// Create a custom renderer with specified width
	r, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(width),
	)
	if err != nil {
		// Fallback to simple rendering if Glamour fails
		return content
	}

	out, err := r.Render(content)
	if err != nil {
		// Fallback to simple rendering if Glamour fails
		return content
	}

	return out
}

// generateChatTitle creates a meaningful title from the first user message
func generateChatTitle(message string) string {
	// Clean up the message
	message = strings.TrimSpace(message)

	// If message is too long, truncate it
	if len(message) > 50 {
		message = message[:47] + "..."
	}

	// If message is empty, use a default title
	if message == "" {
		return "New Chat"
	}

	return message
}

var (
	textStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("252"))
	spinnerStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("69"))
	helpStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
)

func main() {
	// Check if we're running in test mode
	if len(os.Args) > 1 && os.Args[1] == "test" {
		testToolCalling()
		return
	}

	// Check if we're running in chat persistence test mode
	if len(os.Args) > 1 && os.Args[1] == "chat-test" {
		testChatPersistence()
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

// testChatPersistence tests the chat persistence functionality
func testChatPersistence() {
	fmt.Println("🧪 Testing Chat Persistence...")

	// Test Cerebras client initialization
	cerebras, err := NewCerebrasClient()
	if err != nil {
		log.Printf("❌ Failed to initialize Cerebras client: %v", err)
		return
	}
	fmt.Println("✅ Cerebras client initialized successfully")

	// Test chat creation
	fmt.Println("\n📝 Testing chat creation...")
	chatID, err := cerebras.CreateChat("Test Chat", "Hello, this is a test message")
	if err != nil {
		log.Printf("❌ Failed to create chat: %v", err)
		return
	}
	fmt.Printf("✅ Chat created successfully with ID: %s\n", chatID)

	// Test adding messages
	fmt.Println("\n💬 Testing message addition...")
	err = cerebras.AddMessage("user", "This is a user message")
	if err != nil {
		log.Printf("❌ Failed to add user message: %v", err)
		return
	}
	fmt.Println("✅ User message added successfully")

	err = cerebras.AddMessage("assistant", "This is an assistant response")
	if err != nil {
		log.Printf("❌ Failed to add assistant message: %v", err)
		return
	}
	fmt.Println("✅ Assistant message added successfully")

	// Test chat history retrieval
	fmt.Println("\n📚 Testing chat history retrieval...")
	chats, err := cerebras.GetChatHistory()
	if err != nil {
		log.Printf("❌ Failed to get chat history: %v", err)
		return
	}
	fmt.Printf("✅ Retrieved %d chats from history\n", len(chats))

	// Display chat history
	if len(chats) > 0 {
		fmt.Println("\n📋 Chat History:")
		for i, chat := range chats {
			title := "Untitled"
			if t, ok := chat["title"].(string); ok {
				title = t
			}
			createdAt := "Unknown"
			if c, ok := chat["createdAt"].(float64); ok {
				createdAt = time.Unix(int64(c)/1000, 0).Format("Jan 02, 2006 15:04")
			}
			fmt.Printf("  %d. %s - %s\n", i+1, title, createdAt)
		}
	}

	// Test loading specific chat
	if len(chats) > 0 {
		fmt.Println("\n🔍 Testing chat loading...")
		if chatID, ok := chats[0]["_id"].(string); ok {
			chat, err := cerebras.LoadChat(chatID)
			if err != nil {
				log.Printf("❌ Failed to load chat: %v", err)
			} else {
				fmt.Printf("✅ Chat loaded successfully: %s\n", chat["title"])
			}
		}
	}

	fmt.Println("\n🎉 Chat persistence test completed!")
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
	keys            keyMap
	help            help.Model
	showHelp        bool
	chatID          string // Current chat ID for persistence
	chatTitle       string // Current chat title
}

func initialModel() model {
	ta := textarea.New()
	ta.Placeholder = "Send a message..."
	ta.Focus()

	ta.Prompt = "┃ "
	ta.CharLimit = 280

	ta.SetWidth(30)
	ta.SetHeight(3)

	// Remove cursor line styling
	ta.FocusedStyle.CursorLine = lipgloss.NewStyle()

	ta.ShowLineNumbers = false

	vp := viewport.New(30, 5)
	welcomeMessage := `# Welcome to Kite - Your Personal Git Assistant!

*Ready to help you with your Git workflow!*`
	renderedWelcome := renderMarkdown(welcomeMessage)
	// Width-wrap initial content for better layout
	vp.SetContent(lipgloss.NewStyle().Width(vp.Width).Render(renderedWelcome))

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
		keys:            keys,
		help:            help.New(),
		showHelp:        false,
		chatID:          "",
		chatTitle:       "",
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
		hpCmd tea.Cmd
	)

	m.textarea, tiCmd = m.textarea.Update(msg)
	m.viewport, vpCmd = m.viewport.Update(msg)
	m.spinner, spCmd = m.spinner.Update(msg)
	m.help, hpCmd = m.help.Update(msg)

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.viewport.Width = msg.Width
		m.textarea.SetWidth(msg.Width)
		m.help.Width = msg.Width
		// Match example behavior: viewport height from window minus textarea and gap
		m.viewport.Height = msg.Height - m.textarea.Height() - lipgloss.Height(gap)

		if len(m.messages) > 0 {
			// Refresh viewport without forcing width/height to avoid clipping
			m.refreshViewport()
		}
		m.viewport.GotoBottom()
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC, tea.KeyEsc:
			fmt.Println(m.textarea.Value())
			return m, tea.Quit
		case tea.KeyRunes:
		case tea.KeyCtrlL:
			// Clear chat history and messages
			m.messages = []string{}
			m.chatHistory = []CerebrasMessage{}
			m.currentResponse = ""

			// Show welcome message again
			welcomeMessage := `# Welcome to Kite - Your Personal Git Assistant!

*Ready to help you with your Git workflow!*`
			renderedWelcome := renderMarkdown(welcomeMessage)
			m.viewport.SetContent(renderedWelcome)
			m.viewport.GotoBottom()
			return m, nil
		case tea.KeyEnter:
			if m.isStreaming {
				// Don't allow new messages while streaming
				return m, nil
			}

			message := m.textarea.Value()
			if message == "" {
				return m, nil
			}

			// Handle special commands
			switch strings.ToLower(strings.TrimSpace(message)) {
			case "/clear":
				// Clear chat history and messages
				m.messages = []string{}
				m.chatHistory = []CerebrasMessage{}
				m.currentResponse = ""

				// Show welcome message again
				welcomeMessage := `# Welcome to Kite - Your Personal Git Assistant!

*Ready to help you with your Git workflow!*`
				renderedWelcome := renderMarkdown(welcomeMessage)
				m.viewport.SetContent(renderedWelcome)
				m.textarea.Reset()
				m.viewport.GotoBottom()
				return m, nil

			case "/help", "?":
				// Show help
				renderedHelp := renderMarkdown(helpText)
				m.messages = append(m.messages, textStyle.Render("Kite: ")+renderedHelp)
				m.refreshViewport()
				m.textarea.Reset()
				m.viewport.GotoBottom()
				return m, nil

			case "/history":
				// Show chat history
				if m.cerebras != nil {
					chats, err := m.cerebras.GetChatHistory()
					if err != nil {
						historyMessage := fmt.Sprintf("**Error loading chat history:** %v", err)
						m.messages = append(m.messages, textStyle.Render("Kite: ")+historyMessage)
					} else {
						if len(chats) == 0 {
							historyMessage := "**No previous chats found.**\n\nStart a conversation to create your first chat!"
							m.messages = append(m.messages, textStyle.Render("Kite: ")+historyMessage)
						} else {
							historyMessage := "**Your Chat History:**\n\n"
							for i, chat := range chats {
								title := "Untitled"
								if t, ok := chat["title"].(string); ok {
									title = t
								}
								createdAt := "Unknown"
								if c, ok := chat["createdAt"].(float64); ok {
									createdAt = time.Unix(int64(c)/1000, 0).Format("Jan 02, 2006 15:04")
								}
								historyMessage += fmt.Sprintf("%d. **%s** - %s\n", i+1, title, createdAt)
							}
							m.messages = append(m.messages, textStyle.Render("Kite: ")+historyMessage)
						}
					}
				} else {
					historyMessage := "**Chat history not available** - Backend client not initialized."
					m.messages = append(m.messages, textStyle.Render("Kite: ")+historyMessage)
				}
				m.refreshViewport()
				m.textarea.Reset()
				m.viewport.GotoBottom()
				return m, nil

			case "exit", "quit":
				// Quit the application
				return m, tea.Quit
			}

			m.messages = append(m.messages, m.senderStyle.Render("You: ")+message)

			// Add user message to chat history
			m.chatHistory = append(m.chatHistory, CerebrasMessage{
				Role:    "user",
				Content: message,
			})

			// Create new chat if this is the first message
			if m.chatID == "" && m.cerebras != nil {
				// Generate a chat title from the first message
				title := generateChatTitle(message)
				m.chatTitle = title

				// Create chat in the database
				chatID, err := m.cerebras.CreateChat(title, message)
				if err != nil {
					log.Printf("Warning: Failed to create chat: %v", err)
				} else {
					m.chatID = chatID
				}
			} else if m.chatID != "" && m.cerebras != nil {
				// Save user message to existing chat
				err := m.cerebras.AddMessage("user", message)
				if err != nil {
					log.Printf("Warning: Failed to save user message: %v", err)
				}
			}

			// Start streaming response
			if m.cerebras != nil {
				m.startSpinner("Kite is cooking...")
				m.isStreaming = true
				m.currentResponse = ""
				// Add empty bot message that will be filled with streaming content
				m.messages = append(m.messages, textStyle.Render("Kite: "))

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
		m.messages = append(m.messages, textStyle.Render("Kite: ")+renderedResponse)
		m.refreshViewport()
		m.textarea.Reset()
		m.viewport.GotoBottom()
		return m, nil

	case streamingChunkMsg:
		// Update the current response with the new chunk
		m.currentResponse += msg.chunk

		// Update the last message with the current streaming content (render markdown)
		if len(m.messages) > 0 {
			renderedResponse := renderMarkdownWithWidth(m.currentResponse, m.viewport.Width)
			m.messages[len(m.messages)-1] = textStyle.Render("Kite: ") + renderedResponse
			m.refreshViewport()
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

			// Save assistant message to database
			if m.chatID != "" && m.cerebras != nil {
				err := m.cerebras.AddMessage("assistant", msg.response)
				if err != nil {
					log.Printf("Warning: Failed to save assistant message: %v", err)
				}
			}
		}

		// Update the last message with the full response (render markdown)
		if len(m.messages) > 0 {
			renderedResponse := renderMarkdownWithWidth(msg.response, m.viewport.Width)
			m.messages[len(m.messages)-1] = textStyle.Render("Kite: ") + renderedResponse
			m.refreshViewport()
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
		authMessage := `# 🔐 Authentication Required

**You are not authenticated.** Let's authenticate you first!

I'll open your browser to complete the authentication process.

> This will allow you to access all Kite features including GitHub integration.`
		renderedAuth := renderMarkdown(authMessage)
		m.messages = append(m.messages, textStyle.Render("Kite: ")+renderedAuth)
		m.refreshViewport()
		m.viewport.GotoBottom()

		// Start authentication flow
		return m, m.startAuthFlow()

	case authCompleteMsg:
		// Authentication completed, refresh API key from backend
		fmt.Printf("🔄 Authentication completed, refreshing API key from backend...\n")
		if m.cerebras != nil {
			m.cerebras.RefreshApiKeyFromBackend()
		} else {
			fmt.Printf("❌ Cerebras client is nil, cannot refresh API key\n")
		}

		// Show success message
		successMessage := `# ✅ Authentication Complete!

*Ready to help you with your Git workflow!*`
		renderedSuccess := renderMarkdown(successMessage)
		m.messages = append(m.messages, textStyle.Render("Kite: ")+renderedSuccess)
		m.refreshViewport()
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
		m.messages = append(m.messages, textStyle.Render("Kite: ")+renderedError)
		m.refreshViewport()
		m.textarea.Reset()
		m.viewport.GotoBottom()
		return m, nil

	// We handle errors just like any other message
	case errMsg:
		m.err = msg
		return m, nil
	}

	return m, tea.Batch(tiCmd, vpCmd, spCmd, hpCmd)
}

func (m *model) makeAPIRequest() tea.Cmd {
	return func() tea.Msg {
		// Check authentication first
		if m.auth != nil {
			authenticated, _, err := m.auth.CheckAuthStatus()
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

// refreshViewport joins all messages and sets the viewport content without
// enforcing additional width/height constraints that can cause clipping or
// broken wrapping with multi-line and ANSI-rendered markdown content.
func (m *model) refreshViewport() {
	wrapped := lipgloss.NewStyle().Width(m.viewport.Width).Render(strings.Join(m.messages, "\n"))
	m.viewport.SetContent(wrapped)
}

func (m *model) checkAuthOnStartup() tea.Cmd {
	return func() tea.Msg {
		// Check authentication status on startup
		if m.auth != nil {
			authenticated, _, err := m.auth.CheckAuthStatus()
			if err != nil {
				// Log error but don't show to user yet
				log.Printf("Failed to check auth status on startup: %v", err)
				return nil
			}

			if !authenticated {
				// Return auth required message to trigger auth flow
				return authRequiredMsg{}
			} else {
				// User is already authenticated, refresh API key
				return authCompleteMsg{}
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

	// Add help view if showing help
	if m.showHelp {
		helpView := m.help.View(m.keys)
		content += "\n" + helpStyle.Render("--- Help Mode ---\n"+helpView)
	}

	// Add muted help text at the bottom
	mutedHelp := helpStyle.Render("Type /help for detailed help • Ctrl+L to clear chat • Esc to quit")

	return fmt.Sprintf(
		"%s%s%s\n%s",
		content,
		gap,
		m.textarea.View(),
		mutedHelp,
	)
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
