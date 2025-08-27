# Kite - AI-Powered GitHub Assistant

Kite is an intelligent GitHub assistant that helps you manage repositories, review code, and automate development workflows using AI.

## Features

- 🤖 **AI-Powered**: Uses advanced AI models for intelligent code analysis and suggestions
- 🔐 **Secure Authentication**: OAuth integration with GitHub via Clerk
- 💬 **Interactive Chat**: Natural language interface for GitHub operations
- 🎨 **Beautiful UI**: Modern web interface and stunning terminal CLI
- ⚡ **Fast & Reliable**: Built with TypeScript and Go for optimal performance
- 🔧 **Tool Integration**: Seamless integration with GitHub APIs

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web App       │    │   Go CLI         │    │   TypeScript    │
│   (React/Next)  │    │   (Charm/Bubble) │    │   Backend       │
│                 │    │                  │    │                 │
│ • User Auth     │    │ • Beautiful TUI  │    │ • AI Processing │
│ • Dashboard     │    │ • Chat Interface │    │ • GitHub API    │
│ • Repository    │    │ • Fast & Light   │    │ • Tool Calling  │
│   Management    │    │ • Cross-platform │    │ • Auth Store    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │      HTTP API Layer       │
                    │   (Express.js Server)     │
                    └───────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js 18+** and **Bun** for the web app
- **Go 1.21+** for the CLI
- **GitHub account** for authentication

### 1. Clone and Setup

```bash
git clone <repository-url>
cd openai-gptoss-hackathon

# Install dependencies
cd kite
bun install
cd ../tui
go mod tidy
cd ..
```

### 2. Environment Configuration

Create a `.env` file in the `kite` directory:

```env
# GitHub OAuth (via Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret

# Cerebras AI
CEREBRAS_API_KEY=your_cerebras_key

# GitHub API
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 3. Start the Application

#### Option A: Web App Only

```bash
cd kite
bun run dev
```

Visit `http://localhost:3000` to use the web interface.

#### Option B: Go CLI (Recommended)

**Windows:**
```powershell
.\run-cli.ps1
```

**Linux/macOS:**
```bash
./run-cli.sh
```

#### Option C: Manual Setup

1. Start the API server:
```bash
cd kite
bun run api:dev
```

2. In another terminal, run the CLI:
```bash
cd tui
go run main.go
```

## Usage

### Web Interface

1. **Sign In**: Visit `http://localhost:3000` and sign in with GitHub
2. **Dashboard**: View your repositories and recent activity
3. **Chat**: Use the AI assistant for repository management
4. **Sync**: Connect and sync your GitHub repositories

### Go CLI

1. **Authentication**: Complete auth via web interface first
2. **Chat**: Type your questions in the beautiful terminal interface
3. **Navigation**: Use keyboard shortcuts for interaction
4. **Quit**: Press `Ctrl+C` or `q` to exit

## API Endpoints

The TypeScript backend provides these HTTP endpoints:

- `GET /health` - Health check
- `GET /auth/status` - Check authentication status
- `POST /chat` - Send chat message to AI assistant

## Development

### Project Structure

```
├── kite/                 # TypeScript web app
│   ├── src/
│   │   ├── app/         # Next.js pages
│   │   ├── backend/     # Core backend logic
│   │   └── components/  # React components
│   └── package.json
├── tui/                  # Go CLI application
│   ├── main.go          # Main CLI application
│   └── go.mod
└── README.md
```

### Adding Features

1. **Backend Logic**: Add to `kite/src/backend/`
2. **Web Interface**: Add to `kite/src/app/` and `kite/src/components/`
3. **CLI Interface**: Update `tui/main.go`
4. **API Endpoints**: Add to `kite/src/backend/api-server.ts`

### Building

```bash
# Web app
cd kite
bun run build

# CLI
cd tui
go build -o kite-cli main.go
```

## Troubleshooting

### Authentication Issues

1. Ensure Clerk is properly configured
2. Check GitHub OAuth app settings
3. Verify environment variables

### CLI Connection Issues

1. Make sure API server is running on port 3001
2. Check authentication status
3. Verify network connectivity

### Build Issues

1. Update dependencies: `bun install` and `go mod tidy`
2. Check Go and Node.js versions
3. Clear caches and rebuild

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Roadmap

- [ ] gRPC support for better performance
- [ ] Streaming responses in CLI
- [ ] Repository browsing interface
- [ ] Advanced GitHub workflow automation
- [ ] Multi-language support
- [ ] Plugin system for custom tools
