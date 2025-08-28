# Kite Go CLI - Git Assistant with Tool Calling

A Go-based terminal user interface (TUI) for Kite, your personal Git assistant powered by GPT-OSS. This CLI tool integrates with the TypeScript backend to provide intelligent Git operations and repository management.

## Features

- **Interactive TUI**: Beautiful terminal interface with markdown rendering
- **Tool Calling**: Full integration with the TypeScript backend's tool system
- **Git Operations**: Intelligent commit splitting, branch management, PR creation, and more
- **Real-time Streaming**: Live response streaming from the Cerebras API
- **Multi-turn Conversations**: Support for complex workflows requiring multiple tool calls

## Prerequisites

- Go 1.21 or later
- Node.js and npm (for the TypeScript backend)
- Cerebras API key
- GitHub token (for Git operations)

## Setup

1. **Install Dependencies**:
   ```bash
   go mod tidy
   ```

2. **Environment Variables**:
   Create a `.env` file in the `tui` directory:
   ```env
   CEREBRAS_API_KEY=your_cerebras_api_key_here
   BACKEND_URL=http://localhost:3001
   ```

3. **Start the TypeScript Backend**:
   ```bash
   cd ../kite
   npm run dev
   ```

4. **Build and Run the CLI**:
   ```bash
   cd ../tui
   go build -o cerebras-chat.exe .
   ./cerebras-chat.exe
   ```

## Available Tools

The CLI supports all tools from the TypeScript backend:

### Git Operations
- `checkout_branch` - Switch to a different branch
- `create_branch` - Create a new branch
- `commit_and_push` - Commit and push changes (with intelligent splitting)
- `intelligent_commit_split` - Split changes into logical commits
- `check_changes_threshold` - Check if changes exceed threshold
- `check_git_status` - Check current Git status
- `check_branch_exists` - Verify branch existence
- `list_repository_commits` - List recent commits

### Pull Request Management
- `list_pull_requests` - List PRs in a repository
- `get_pull_request` - Get PR details
- `create_pr` - Create a new pull request
- `update_pull_request` - Update PR details
- `merge_pr` - Merge a pull request
- `list_pull_request_commits` - List commits in a PR
- `list_pull_request_files` - List files changed in a PR
- `check_pull_request_merged` - Check if PR is merged
- `update_pull_request_branch` - Update PR branch

### Issue Management
- `list_issues` - List issues in a repository
- `get_issue` - Get issue details
- `create_issue` - Create a new issue
- `update_issue` - Update issue details

### Repository Management
- `list_repos` - List user repositories

## Usage Examples

### Basic Git Operations
```
You: commit and push with message "Add new feature"
Bot: ✅ Successfully committed changes with message: 'Add new feature'
     📤 Pushed to remote
```

### Creating Pull Requests
```
You: create a pull request for my-feature branch
Bot: I need some information to create the pull request:
     - Repository name (owner/repo format)
     - Title for the pull request
     - Description
     - Head branch (default: my-feature)
     - Base branch (default: main)
```

### Intelligent Commit Splitting
```
You: split my large changes into logical commits
Bot: 🚀 Large changes detected (1500 lines). Successfully executed intelligent commit splitting.
     Created 3 logical commits:
     1. feat: Add user authentication system
     2. feat: Implement dashboard components
     3. fix: Resolve login validation issues
```

## Architecture

### Components

1. **CerebrasClient** (`cerebras.go`):
   - Handles communication with Cerebras API
   - Manages streaming responses
   - Integrates tool calling capabilities

2. **BackendClient** (`tools.go`):
   - Communicates with TypeScript backend
   - Executes tools via HTTP API
   - Handles tool result formatting

3. **TUI Model** (`main.go`):
   - Manages the terminal interface
   - Handles user input and display
   - Coordinates between Cerebras and backend

### Tool Calling Flow

1. User sends a message requesting a Git operation
2. Cerebras API analyzes the request and identifies needed tools
3. Go CLI receives tool calls and forwards them to TypeScript backend
4. Backend executes the tools (Git operations, GitHub API calls)
5. Results are returned to the CLI and displayed to the user

## Development

### Adding New Tools

1. **Define the tool** in `tools.go`:
   ```go
   {
       Type: "function",
       Function: struct {
           Name        string                 `json:"name"`
           Description string                 `json:"description"`
           Parameters  map[string]interface{} `json:"parameters"`
       }{
           Name:        "your_tool_name",
           Description: "Description of what the tool does",
           Parameters: map[string]interface{}{
               // Define parameters
           },
       },
   }
   ```

2. **Implement the tool** in the TypeScript backend (`toolCalling.ts`)

3. **Update the backend API** if needed

### Building for Distribution

```bash
# Windows
go build -o cerebras-chat.exe .

# Linux/macOS
go build -o cerebras-chat .
```

## Troubleshooting

### Common Issues

1. **Backend Connection Failed**:
   - Ensure the TypeScript backend is running on `http://localhost:3001`
   - Check `BACKEND_URL` environment variable

2. **Cerebras API Errors**:
   - Verify `CEREBRAS_API_KEY` is set correctly
   - Check API key permissions and quotas

3. **Git Operations Fail**:
   - Ensure you're in a Git repository
   - Check GitHub token permissions
   - Verify repository access

### Debug Mode

Set environment variable for verbose logging:
```bash
export DEBUG=true
./cerebras-chat.exe
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the GPT-OSS hackathon project.
