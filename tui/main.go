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

const (
	kiteAsciiArt = `
╭─────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                                                                                             │
│    ██╗  ██╗██╗████████╗███████╗    ██╗  ██╗██╗████████╗███████╗    ██╗  ██╗██╗████████╗███████╗          │
│    ██║ ██╔╝██║╚══██╔══╝██╔════╝    ██║ ██╔╝██║╚══██╔══╝██╔════╝    ██║ ██╔╝██║╚══██╔══╝██╔════╝          │
│    █████╔╝ ██║   ██║   █████╗      █████╔╝ ██║   ██║   █████╗      █████╔╝ ██║   ██║   █████╗            │
│    ██╔═██╗ ██║   ██║   ██╔══╝      ██╔═██╗ ██║   ██║   ██╔══╝      ██╔═██╗ ██║   ██║   ██╔══╝            │
│    ██║  ██╗██║   ██║   ███████╗    ██║  ██╗██║   ██║   ███████╗    ██║  ██╗██║   ██║   ███████╗          │
│    ╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝    ╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝    ╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝          │
│                                                                                                             │
│                                    Your Personal Git Assistant                                              │
│                                                                                                             │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
`
)

// Available spinners
var spinners = []spinner.Spinner{
	spinner.Points,
}

// Model options for the dropdown
type modelItem struct {
	title       string
	description string
}

func (i modelItem) Title() string       { return i.title }
func (i modelItem) Description() string { return i.description }
func (i modelItem) FilterValue() string { return i.title }

// keyMap defines a set of keybindings for the help system
type keyMap struct {
	Up    key.Binding
	Down  key.Binding
	Quit  key.Binding
	Clear key.Binding
	Tab   key.Binding
}

// ShortHelp returns keybindings to be shown in the mini help view
func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Quit, k.Tab}
}

// FullHelp returns keybindings for the expanded help view
func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down},  // first column
		{k.Quit, k.Tab}, // second column
		{k.Clear},       // third column
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
	Tab: key.NewBinding(
		key.WithKeys("tab"),
		key.WithHelp("tab", "switch focus"),
	),
}

// helpText provides comprehensive help information
var helpText = `# Kite - Your Personal Git Assistant

## Quick Commands
- **?** or **/help** - Show this help
- **/clear** - Clear chat history
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

	// Ensure minimum width
	if width < 10 {
		width = 10
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

// safeSetViewportContent safely sets viewport content with bounds checking
func (m *model) safeSetViewportContent(content string) {
	// Ensure viewport has valid dimensions
	if m.viewport.Width <= 0 {
		m.viewport.Width = 20
	}
	if m.viewport.Height <= 0 {
		m.viewport.Height = 10
	}

	// Apply width constraint to prevent overflow
	maxWidth := m.viewport.Width - 4
	if maxWidth < 10 {
		maxWidth = 10
	}

	// Don't constrain height to allow natural content flow
	styledContent := lipgloss.NewStyle().
		Width(maxWidth).
		Render(content)

	m.viewport.SetContent(styledContent)
}

// Styles for the beautiful UI
var (
	// Main container styles
	appStyle = lipgloss.NewStyle().
			Padding(2, 2).
			Margin(1, 0, 0, 0).
			Background(lipgloss.Color("#1a1a2e"))

	// Sidebar styles
	sidebarStyle = lipgloss.NewStyle().
			Width(30).
			Height(20).
			Padding(1, 2).
			Margin(1, 0, 0, 0).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#ff6b6b")).
			Background(lipgloss.Color("#16213e"))

	// Logo styles
	logoStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#ff6b6b")).
			Bold(true).
			Align(lipgloss.Center).
			Margin(1, 0)

	// Gradient text for KITE logo
	kiteLogoStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#ff6b6b")).
			Bold(true).
			Align(lipgloss.Center).
			Margin(0, 0, 1, 0)

	// Status styles
	statusStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#74b9ff")).
			Margin(1, 0)

	// Chat area styles
	chatStyle = lipgloss.NewStyle().
			Padding(1, 2).
			Margin(1, 0, 0, 0).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#74b9ff")).
			Background(lipgloss.Color("#0f0f23"))

	// Text styles
	textStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("#ffffff"))
	spinnerStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#74b9ff"))
	helpStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("#636e72"))
	senderStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("#ff6b6b")).Bold(true)
	botStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("#74b9ff")).Bold(true)

	// Input styles
	inputStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#74b9ff")).
			Padding(0, 1).
			Background(lipgloss.Color("#2d3436"))

	// LSP/MCP styles
	lspStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#00b894")).
			Margin(0, 0, 0, 1)

	mcpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#fdcb6e")).
			Margin(0, 0, 0, 1)

	// Section headers
	sectionHeaderStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#ffffff")).
				Bold(true).
				Margin(1, 0, 0, 0)

	// Right column styles
	rightColumnStyle = lipgloss.NewStyle().
				Width(35).
				Height(25).
				Padding(1, 2).
				Margin(1, 0, 0, 0).
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("#00b894")).
				Background(lipgloss.Color("#16213e"))

	// Model dropdown styles
	modelDropdownStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("#00b894")).
				Padding(0, 1).
				Background(lipgloss.Color("#2d3436"))

	modelItemStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#ffffff")).
			Padding(0, 1)

	modelItemSelectedStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#00b894")).
				Background(lipgloss.Color("#2d3436")).
				Bold(true).
				Padding(0, 1)

	focusIndicatorStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#00b894")).
				Bold(true)
)

func main() {
	// Check if we're running in test mode
	if len(os.Args) > 1 && os.Args[1] == "test" {
		testToolCalling()
		return
	}

	// Ensure console is maximized on Windows (no-op on others)
	maximizeConsoleWindow()

	p := tea.NewProgram(initialModel())

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
	width           int
	height          int
	// Right column components
	modelOptions       []modelItem
	selectedModelIndex int
	showModelDropdown  bool
	focus              string // "chat", "model", or "input"
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

	vp := viewport.New(80, 20)
	welcomeMessage := `# Welcome to Kite - Your Personal Git Assistant!

*Ready to help you with your Git workflow!*`
	renderedWelcome := renderMarkdown(welcomeMessage)

	ta.KeyMap.InsertNewline.SetEnabled(false)

	// Initialize spinner
	s := spinner.New()
	s.Style = spinnerStyle
	s.Spinner = spinners[0]

	// Initialize model options for right column
	modelOptions := []modelItem{
		{title: "GPT-OSS-120B", description: "Default model"},
		{title: "GPT-4", description: "OpenAI GPT-4"},
		{title: "Claude-3", description: "Anthropic Claude"},
		{title: "Gemini-Pro", description: "Google Gemini"},
		{title: "Llama-3", description: "Meta Llama 3"},
	}

	// Initialize Cerebras client
	cerebras, err := NewCerebrasClient()
	if err != nil {
		log.Printf("Warning: Failed to initialize Cerebras client: %v", err)
	}

	// Initialize auth client
	auth := NewAuthClient()

	model := model{
		textarea:           ta,
		messages:           []string{},
		viewport:           vp,
		err:                nil,
		spinner:            s,
		spinnerIdx:         0,
		isSpinning:         false,
		spinnerMsg:         "",
		cerebras:           cerebras,
		auth:               auth,
		chatHistory:        []CerebrasMessage{},
		currentResponse:    "",
		isStreaming:        false,
		responseChan:       nil,
		errorChan:          nil,
		keys:               keys,
		help:               help.New(),
		showHelp:           false,
		width:              80,
		height:             24,
		modelOptions:       modelOptions,
		selectedModelIndex: 0,
		showModelDropdown:  false,
		focus:              "input",
	}

	// Set initial content safely
	model.safeSetViewportContent(renderedWelcome)

	return model
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		textarea.Blink,
		m.spinner.Tick,
		tea.SetWindowTitle("Kite - Your Personal Git Assistant"),
		m.checkAuthOnStartup(),
		tea.EnterAltScreen,
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
		m.width = msg.Width
		m.height = msg.Height

		// Calculate layout dimensions with bounds checking
		// Account for top section height (approximately 15 lines for the wider logo)
		topSectionHeight := 15
		sidebarWidth := 30
		rightColumnWidth := 35
		chatWidth := msg.Width - sidebarWidth - rightColumnWidth - 8 // Account for padding and borders
		chatHeight := msg.Height - topSectionHeight - 10             // Account for top section, input and help text with more padding

		// Ensure minimum dimensions
		if chatWidth < 20 {
			chatWidth = 20
		}
		if chatHeight < 10 {
			chatHeight = 10
		}

		// Update viewport and textarea dimensions
		m.viewport.Width = chatWidth - 4
		m.viewport.Height = chatHeight - 4
		m.textarea.SetWidth(chatWidth - 4)
		m.help.Width = chatWidth

		if len(m.messages) > 0 {
			// Join messages and render markdown for the entire content
			content := strings.Join(m.messages, "\n")
			m.safeSetViewportContent(content)
			m.viewport.GotoBottom()
		}

	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC, tea.KeyEsc:
			fmt.Println(m.textarea.Value())
			return m, tea.Sequence(tea.ExitAltScreen, tea.Quit)
		case tea.KeyTab:
			// Switch focus between input, chat, and model dropdown
			switch m.focus {
			case "input":
				m.focus = "model"
				m.showModelDropdown = true
			case "model":
				m.focus = "chat"
				m.showModelDropdown = false
			case "chat":
				m.focus = "input"
				m.showModelDropdown = false
			}
			return m, nil
		case tea.KeyRunes:
		case tea.KeyUp:
			if m.focus == "model" && m.showModelDropdown {
				if m.selectedModelIndex > 0 {
					m.selectedModelIndex--
				}
				return m, nil
			}
		case tea.KeyDown:
			if m.focus == "model" && m.showModelDropdown {
				if m.selectedModelIndex < len(m.modelOptions)-1 {
					m.selectedModelIndex++
				}
				return m, nil
			}
		case tea.KeyEnter:
			if m.focus == "model" && m.showModelDropdown {
				// Select the current model and close dropdown
				m.showModelDropdown = false
				m.focus = "input"
				return m, nil
			}
			// Fall through to original Enter key handling for chat input
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
				m.safeSetViewportContent(renderedWelcome)
				m.textarea.Reset()
				m.viewport.GotoBottom()
				return m, nil

			case "/help", "?":
				// Show help
				renderedHelp := renderMarkdown(helpText)
				m.messages = append(m.messages, botStyle.Render("Kite: ")+renderedHelp)
				m.safeSetViewportContent(strings.Join(m.messages, "\n"))
				m.textarea.Reset()
				m.viewport.GotoBottom()
				return m, nil

			case "exit", "quit":
				// Quit the application
				return m, tea.Sequence(tea.ExitAltScreen, tea.Quit)
			}

			m.messages = append(m.messages, senderStyle.Render("You: ")+message)

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
				m.messages = append(m.messages, botStyle.Render("Kite: "))

				return m, m.makeAPIRequest()
			} else {
				// Fallback if Cerebras client is not available
				m.startSpinner("Cerebras client not available...")
				return m, tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
					return spinnerCompleteMsg{response: "**Error:** Cerebras client not initialized. Please check your `CEREBRAS_API_KEY` environment variable."}
				})
			}
		case tea.KeyCtrlL:
			// Clear chat history and messages
			m.messages = []string{}
			m.chatHistory = []CerebrasMessage{}
			m.currentResponse = ""

			// Show welcome message again
			welcomeMessage := `# Welcome to Kite - Your Personal Git Assistant!

*Ready to help you with your Git workflow!*`
			renderedWelcome := renderMarkdown(welcomeMessage)
			m.safeSetViewportContent(renderedWelcome)
			m.viewport.GotoBottom()
			return m, nil

		}
	case spinnerCompleteMsg:
		m.stopSpinner()
		// Render markdown for the bot response
		renderedResponse := renderMarkdown(msg.response)
		m.messages = append(m.messages, botStyle.Render("Kite: ")+renderedResponse)
		m.safeSetViewportContent(strings.Join(m.messages, "\n"))
		m.textarea.Reset()
		m.viewport.GotoBottom()
		return m, nil

	case streamingChunkMsg:
		// Update the current response with the new chunk
		m.currentResponse += msg.chunk

		// Update the last message with the current streaming content (render markdown)
		if len(m.messages) > 0 {
			renderedResponse := renderMarkdownWithWidth(m.currentResponse, m.viewport.Width)
			m.messages[len(m.messages)-1] = botStyle.Render("Kite: ") + renderedResponse
			m.safeSetViewportContent(strings.Join(m.messages, "\n"))
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
			m.messages[len(m.messages)-1] = botStyle.Render("Kite: ") + renderedResponse
			m.safeSetViewportContent(strings.Join(m.messages, "\n"))
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
		m.messages = append(m.messages, botStyle.Render("Kite: ")+renderedAuth)
		m.safeSetViewportContent(strings.Join(m.messages, "\n"))
		m.viewport.GotoBottom()

		// Start authentication flow
		return m, m.startAuthFlow()

	case authCompleteMsg:
		// Authentication completed, show success message
		successMessage := `# ✅ Authentication Complete!

**Authentication completed successfully!**

You can now continue using Kite with all features including:

- 🔗 GitHub repository access
- 🛠️ Tool calling capabilities
- 📊 Repository analytics

*Ready to help you with your Git workflow!*`
		renderedSuccess := renderMarkdown(successMessage)
		m.messages = append(m.messages, botStyle.Render("Kite: ")+renderedSuccess)
		m.safeSetViewportContent(strings.Join(m.messages, "\n"))
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
		m.messages = append(m.messages, botStyle.Render("Kite: ")+renderedError)
		m.safeSetViewportContent(strings.Join(m.messages, "\n"))
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

// renderTopSection creates the top section with Kite logo only
func (m model) renderTopSection() string {
	// Kite Logo with gradient effect
	kiteLogo := kiteLogoStyle.Render(kiteAsciiArt)

	return lipgloss.NewStyle().
		Padding(2, 2).
		Margin(1, 0, 0, 0).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#ff6b6b")).
		Background(lipgloss.Color("#16213e")).
		Render(kiteLogo)
}

// renderSidebar creates the beautiful sidebar with Kite branding and status
func (m model) renderSidebar() string {
	var sections []string

	// Sidebar title
	title := focusIndicatorStyle.Render("Quick Actions")
	sections = append(sections, title)

	// Add some quick action buttons or info
	actions := []string{
		"• /help - Show help",
		"• /clear - Clear chat",
		"• Tab - Switch focus",
		"• Esc - Quit",
	}

	for _, action := range actions {
		sections = append(sections, modelItemStyle.Render(action))
	}

	// Join all sections
	sidebarContent := strings.Join(sections, "\n")

	return sidebarStyle.Render(sidebarContent)
}

// renderRightColumn creates the right column with status, model info, and model selection
func (m model) renderRightColumn() string {
	var sections []string

	// Status section - update based on streaming state
	var status string
	if m.isStreaming {
		status = statusStyle.Render("Status: Thinking...")
	} else {
		status = statusStyle.Render("Status: Ready")
	}
	sections = append(sections, status)

	// Current model info
	currentModel := m.modelOptions[m.selectedModelIndex]
	modelInfo := statusStyle.Render(fmt.Sprintf("Model: %s", currentModel.title))
	sections = append(sections, modelInfo)

	// Separator
	sections = append(sections, "")

	// Model Selection Title
	title := focusIndicatorStyle.Render("Model Selection")
	if m.focus == "model" {
		title = focusIndicatorStyle.Render("Model Selection [FOCUSED]")
	}
	sections = append(sections, title)

	// Current selected model
	selectedModelText := modelItemSelectedStyle.Render(fmt.Sprintf("Current: %s", currentModel.title))
	sections = append(sections, selectedModelText)

	// Model dropdown
	if m.showModelDropdown {
		dropdownTitle := modelItemStyle.Render("Available Models:")
		sections = append(sections, dropdownTitle)

		for i, model := range m.modelOptions {
			if i == m.selectedModelIndex {
				item := modelItemSelectedStyle.Render(fmt.Sprintf("▶ %s", model.title))
				sections = append(sections, item)
			} else {
				item := modelItemStyle.Render(fmt.Sprintf("  %s", model.title))
				sections = append(sections, item)
			}
		}

		// Instructions
		instructions := modelItemStyle.Render("↑/↓: Navigate • Enter: Select • Tab: Exit")
		sections = append(sections, instructions)
	} else {
		// Show instructions for opening dropdown
		instructions := modelItemStyle.Render("Press Tab to focus, then Enter to open")
		sections = append(sections, instructions)
	}

	// Join all sections
	rightColumnContent := strings.Join(sections, "\n")

	return rightColumnStyle.Render(rightColumnContent)
}

// renderChatArea creates the main chat area
func (m model) renderChatArea() string {
	chatContent := m.viewport.View()

	// Add spinner if active
	if m.isSpinning {
		spinnerContent := fmt.Sprintf("\n %s %s", m.spinner.View(), textStyle.Render(m.spinnerMsg))
		chatContent += spinnerContent
	}

	return chatStyle.Render(chatContent)
}

// renderInputArea creates the input area at the bottom
func (m model) renderInputArea() string {
	inputContent := inputStyle.Render(m.textarea.View())

	// Add help text
	helpText := helpStyle.Render("Type /help for detailed help • Ctrl+L to clear chat • Esc to quit")

	return lipgloss.JoinVertical(lipgloss.Left, inputContent, helpText)
}

func (m model) View() string {
	// Render top section with logo and status
	topSection := m.renderTopSection()

	// Render sidebar
	sidebar := m.renderSidebar()

	// Render right column
	rightColumn := m.renderRightColumn()

	// Render chat area
	chatArea := m.renderChatArea()

	// Render input area
	inputArea := m.renderInputArea()

	// Combine chat and input areas
	mainArea := lipgloss.JoinVertical(lipgloss.Left, chatArea, inputArea)

	// Join main area, sidebar, and right column horizontally
	layout := lipgloss.JoinHorizontal(lipgloss.Top, mainArea, sidebar, rightColumn)

	// Combine top section with main layout
	fullLayout := lipgloss.JoinVertical(lipgloss.Left, topSection, layout)

	// Apply main app styling
	return appStyle.Render(fullLayout)
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
