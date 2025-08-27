# Kite CLI - Beautiful Go Terminal Interface

A stunning terminal-based interface for Kite, built with Go and Charm/Bubble Tea libraries.

## Features

- 🎨 **Beautiful UI**: Modern terminal interface with colors, borders, and animations
- 💬 **Interactive Chat**: Real-time conversation with AI assistant
- 🔐 **Authentication**: Seamless integration with existing auth flow
- ⚡ **Fast**: Built in Go for optimal performance
- 📱 **Responsive**: Adapts to different terminal sizes

## Prerequisites

1. **Go 1.21+** installed
2. **TypeScript backend** running (see setup below)
3. **Authentication** completed via web interface

## Setup

### 1. Install Dependencies

```bash
cd tui
go mod tidy
```

### 2. Start the TypeScript Backend

In the `kite` directory:

```bash
# Install dependencies (if not already done)
bun install

# Start the API server
bun run api:dev
```

The API server will run on `http://localhost:3001`.

### 3. Authenticate (First Time Only)

1. Open your browser to `http://localhost:3000`
2. Sign in with your GitHub account
3. Complete the authentication flow
4. Return to the terminal

### 4. Run the Go CLI

```bash
cd tui
go run main.go
```

## Usage

- **Type your message** in the input area at the bottom
- **Press Enter** to send your message
- **Press Ctrl+C** or **q** to quit
- **Scroll** through conversation history in the viewport

## Architecture

```
┌─────────────────┐    HTTP API    ┌──────────────────┐
│   Go CLI        │ ◄────────────► │ TypeScript       │
│   (Frontend)    │                │ Backend          │
│                 │                │                  │
│ • Beautiful UI  │                │ • AI Processing  │
│ • User Input    │                │ • GitHub API     │
│ • Display       │                │ • Auth Store     │
└─────────────────┘                └──────────────────┘
```

## Development

### Adding New Features

1. **Backend**: Add new endpoints to `kite/src/backend/api-server.ts`
2. **Frontend**: Update the Go CLI in `tui/main.go`

### Styling

The UI uses Charm's Lip Gloss library for styling. Colors and layouts can be customized in the `View()` function.

### API Endpoints

- `GET /health` - Health check
- `GET /auth/status` - Check authentication
- `POST /chat` - Send chat message

## Troubleshooting

### "Not authenticated" Error

1. Make sure the web server is running: `bun run dev`
2. Visit `http://localhost:3000` and sign in
3. Complete the authentication flow
4. Try the CLI again

### "Connection refused" Error

1. Make sure the API server is running: `bun run api:dev`
2. Check that it's running on port 3001
3. Verify the health endpoint: `curl http://localhost:3001/health`

### Build Issues

```bash
# Clean and rebuild
go clean
go mod tidy
go run main.go
```

## Future Enhancements

- [ ] gRPC support for better performance
- [ ] Streaming responses
- [ ] File upload/download
- [ ] Repository browsing
- [ ] Pull request management
- [ ] Issue tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
