package main

import (
	"fmt"
	"os"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Item represents a list item
type item struct {
	title       string
	description string
}

func (i item) Title() string       { return i.title }
func (i item) Description() string { return i.description }
func (i item) FilterValue() string { return i.title }

// Model represents the main application state
type model struct {
	list     list.Model
	spinner  spinner.Model
	input    textinput.Model
	viewport viewport.Model
	ready    bool
	width    int
	height   int
}

// Initial model
func initialModel() model {
	// Initialize spinner
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	// Initialize text input
	ti := textinput.New()
	ti.Placeholder = "Enter some text..."
	ti.Focus()
	ti.CharLimit = 50
	ti.Width = 40

	// Initialize list
	items := []list.Item{
		item{title: "Raspberry Pi's", description: "I have 'em all over my house"},
		item{title: "Charm", description: "Delightful Go packages for TUI"},
		item{title: "Go", description: "The best programming language"},
		item{title: "Bubble Tea", description: "A powerful little TUI framework"},
		item{title: "Lip Gloss", description: "Style definitions for nice terminal layouts"},
		item{title: "Bubbles", description: "TUI components for Bubble Tea"},
		item{title: "Termenv", description: "Advanced ANSI styling for terminal applications"},
	}

	l := list.New(items, list.NewDefaultDelegate(), 0, 0)
	l.Title = "What do you want to do?"
	l.SetShowHelp(true)

	// Initialize viewport
	vp := viewport.New(60, 10)
	vp.Style = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62"))

	return model{
		list:     l,
		spinner:  s,
		input:    ti,
		viewport: vp,
	}
}

// Init function
func (m model) Init() tea.Cmd {
	return tea.Batch(
		spinner.Tick,
		textinput.Blink,
	)
}

// Update function
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "tab":
			// Cycle through components
			if m.input.Focused() {
				m.input.Blur()
				m.list.SetShowHelp(true)
			} else {
				m.input.Focus()
				m.list.SetShowHelp(false)
			}
		}
	case tea.WindowSizeMsg:
		if !m.ready {
			m.width = msg.Width
			m.height = msg.Height
			m.ready = true

			// Update viewport content
			content := lipgloss.NewStyle().
				Width(m.width - 4).
				Height(m.height - 4).
				Render(fmt.Sprintf("Welcome to the Kite Dummy TUI App!\n\n" +
					"This is a viewport component that can display scrollable content.\n" +
					"You can use it to show logs, documentation, or any long text.\n\n" +
					"Features:\n" +
					"• Beautiful styling with Lip Gloss\n" +
					"• Interactive list with keyboard navigation\n" +
					"• Text input with focus management\n" +
					"• Animated spinner\n" +
					"• Responsive viewport\n\n" +
					"Press 'tab' to cycle between components\n" +
					"Press 'q' to quit"))

			m.viewport.SetContent(content)
		}
	}

	// Update components
	var cmd tea.Cmd
	m.spinner, cmd = m.spinner.Update(msg)
	cmds = append(cmds, cmd)

	m.input, cmd = m.input.Update(msg)
	cmds = append(cmds, cmd)

	m.list, cmd = m.list.Update(msg)
	cmds = append(cmds, cmd)

	m.viewport, cmd = m.viewport.Update(msg)
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
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

	sectionStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62")).
		Padding(1, 2).
		Margin(0, 1)

	// Create the layout
	var sections []string

	// Title
	sections = append(sections, titleStyle.Render("✨ Amazing TUI Application ✨"))

	// Top row: Spinner and Input
	topRow := lipgloss.JoinHorizontal(
		lipgloss.Left,
		sectionStyle.Render(fmt.Sprintf("Loading: %s", m.spinner.View())),
		sectionStyle.Render(fmt.Sprintf("Input: %s", m.input.View())),
	)

	// Middle row: List
	listSection := sectionStyle.Render(m.list.View())

	// Bottom row: Viewport
	viewportSection := sectionStyle.Render(m.viewport.View())

	// Combine all sections
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		sections[0],
		topRow,
		listSection,
		viewportSection,
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
		tea.WithAltScreen(),       // Use alternate screen buffer
		tea.WithMouseCellMotion(), // Turn on mouse support so we can track the mouse wheel
	)

	if _, err := p.Run(); err != nil {
		fmt.Printf("Alas, there's been an error: %v", err)
		os.Exit(1)
	}
}
