package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// API client for communicating with TypeScript backend
type APIClient struct {
	baseURL string
	client  *http.Client
}

func NewAPIClient(baseURL string) *APIClient {
	return &APIClient{
		baseURL: baseURL,
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *APIClient) CheckHealth() error {
	resp, err := c.client.Get(c.baseURL + "/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *APIClient) CheckAuth() (bool, error) {
	resp, err := c.client.Get(c.baseURL + "/auth/status")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var result struct {
		Authenticated bool `json:"authenticated"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}
	return result.Authenticated, nil
}

func (c *APIClient) SendMessage(messages []ChatMessage) (string, error) {
	payload := map[string]interface{}{
		"messages": messages,
		"stream":   false,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	resp, err := c.client.Post(c.baseURL+"/chat", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.Response, nil
}

// Chat message structure
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Model represents the main application state
type model struct {
	apiClient   *APIClient
	messages    []ChatMessage
	viewport    viewport.Model
	textarea    textarea.Model
	spinner     spinner.Model
	ready       bool
	width       int
	height      int
	loading     bool
	error       string
	authChecked bool
}

// Initial model
func initialModel() model {
	// Initialize API client
	apiClient := NewAPIClient("http://localhost:3001")

	// Initialize spinner
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	// Initialize textarea
	ta := textarea.New()
	ta.Placeholder = "Ask me anything about your GitHub repositories..."
	ta.Focus()
	ta.CharLimit = 1000
	ta.SetHeight(3)

	// Initialize viewport
	vp := viewport.New(80, 20)
	vp.Style = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62"))

	return model{
		apiClient: apiClient,
		messages:  []ChatMessage{},
		viewport:  vp,
		textarea:  ta,
		spinner:   s,
	}
}

// Init function
func (m model) Init() tea.Cmd {
	return tea.Batch(
		spinner.Tick,
		textarea.Blink,
		m.checkAPIHealth(),
	)
}

// Commands
func (m model) checkAPIHealth() tea.Cmd {
	return func() tea.Msg {
		if err := m.apiClient.CheckHealth(); err != nil {
			return errorMsg{err.Error()}
		}
		return healthCheckMsg{true}
	}
}

func (m model) checkAuth() tea.Cmd {
	return func() tea.Msg {
		authenticated, err := m.apiClient.CheckAuth()
		if err != nil {
			return errorMsg{err.Error()}
		}
		return authCheckMsg{authenticated}
	}
}

func (m model) sendMessage() tea.Cmd {
	return func() tea.Msg {
		content := strings.TrimSpace(m.textarea.Value())
		if content == "" {
			return nil
		}

		// Add user message
		userMsg := ChatMessage{Role: "user", Content: content}
		messages := append(m.messages, userMsg)

		// Send to API
		response, err := m.apiClient.SendMessage(messages)
		if err != nil {
			return errorMsg{err.Error()}
		}

		// Add assistant message
		assistantMsg := ChatMessage{Role: "assistant", Content: response}
		messages = append(messages, assistantMsg)

		return messageResponseMsg{
			userMessage:      userMsg,
			assistantMessage: assistantMsg,
		}
	}
}

// Messages
type healthCheckMsg struct {
	healthy bool
}

type authCheckMsg struct {
	authenticated bool
}

type messageResponseMsg struct {
	userMessage      ChatMessage
	assistantMessage ChatMessage
}

type errorMsg struct {
	error string
}

// Update function
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "enter":
			if !m.loading && m.authChecked {
				m.loading = true
				return m, tea.Batch(
					spinner.Tick,
					m.sendMessage(),
				)
			}
		}

	case healthCheckMsg:
		if msg.healthy {
			return m, m.checkAuth()
		}

	case authCheckMsg:
		m.authChecked = true
		if !msg.authenticated {
			m.error = "❌ Not authenticated. Please run the web app first and sign in."
		}

	case messageResponseMsg:
		m.loading = false
		m.messages = append(m.messages, msg.userMessage, msg.assistantMessage)
		m.textarea.SetValue("")
		m.updateViewport()

	case errorMsg:
		m.loading = false
		m.error = "❌ " + msg.error

	case tea.WindowSizeMsg:
		if !m.ready {
			m.width = msg.Width
			m.height = msg.Height
			m.ready = true
			m.updateViewport()
		}
	}

	// Update components
	var cmd tea.Cmd
	m.spinner, cmd = m.spinner.Update(msg)
	cmds = append(cmds, cmd)

	m.textarea, cmd = m.textarea.Update(msg)
	cmds = append(cmds, cmd)

	m.viewport, cmd = m.viewport.Update(msg)
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

func (m *model) updateViewport() {
	var content strings.Builder

	// Add welcome message if no messages
	if len(m.messages) == 0 {
		content.WriteString("🤖 Welcome to Kite CLI!\n\n")
		content.WriteString("Ask me anything about your GitHub repositories.\n")
		content.WriteString("I can help you with:\n")
		content.WriteString("• Repository management\n")
		content.WriteString("• Code analysis\n")
		content.WriteString("• Pull request reviews\n")
		content.WriteString("• And much more!\n\n")
		content.WriteString("Type your question below and press Enter.\n")
	} else {
		// Display conversation
		for _, msg := range m.messages {
			if msg.Role == "user" {
				content.WriteString("👤 You: " + msg.Content + "\n\n")
			} else {
				content.WriteString("🤖 Kite: " + msg.Content + "\n\n")
			}
		}
	}

	m.viewport.SetContent(content.String())
	m.viewport.GotoBottom()
}

// View function
func (m model) View() string {
	if !m.ready {
		return "\n  Initializing..."
	}

	// Define styles
	titleStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FAFAFA")).
		Background(lipgloss.Color("#7D56F4")).
		Padding(0, 1).
		Bold(true)

	errorStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FF6B6B")).
		Padding(0, 1)

	loadingStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#4ECDC4")).
		Padding(0, 1)

	// Create the layout
	var sections []string

	// Title
	sections = append(sections, titleStyle.Render("🚀 Kite CLI - AI GitHub Assistant"))

	// Error message
	if m.error != "" {
		sections = append(sections, errorStyle.Render(m.error))
	}

	// Loading indicator
	if m.loading {
		sections = append(sections, loadingStyle.Render(fmt.Sprintf("⏳ %s Processing your request...", m.spinner.View())))
	}

	// Chat viewport
	chatSection := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62")).
		Padding(1, 2).
		Render(m.viewport.View())

	// Input area
	inputSection := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62")).
		Padding(1, 2).
		Render("💬 " + m.textarea.View())

	// Combine all sections
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		append(sections, chatSection, inputSection)...,
	)

	// Center the content
	return lipgloss.Place(
		m.width,
		m.height,
		lipgloss.Center,
		lipgloss.Center,
		content,
	)
}

func main() {
	p := tea.NewProgram(
		initialModel(),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v", err)
		os.Exit(1)
	}
}
