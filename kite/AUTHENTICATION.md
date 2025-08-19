# Kite Authentication Flow

This document explains how authentication works in Kite for both web and CLI users.

## Overview

Kite uses Clerk for authentication with GitHub OAuth. The system supports two authentication flows:

1. **Web Flow**: Users authenticate directly through the web interface
2. **CLI Flow**: Users authenticate through the web interface but initiated from the CLI

## Web Authentication Flow

1. User visits `http://localhost:3000`
2. Clicks "Continue with GitHub"
3. Completes GitHub OAuth flow
4. Redirected to `/dashboard`

## CLI Authentication Flow

1. User runs `bun run chat` in CLI
2. If not authenticated, CLI opens browser to `http://localhost:3000?from_cli=true`
3. User completes GitHub OAuth flow
4. Redirected to `/cli-auth-success` page
5. GitHub OAuth token is automatically saved locally for CLI use
6. User returns to CLI and runs `bun run chat` again

## CLI Commands

### Authentication Status
```bash
bun run auth:status
```
Shows whether you're authenticated and when the token was created.

### Logout
```bash
bun run auth:logout
```
Deletes the stored GitHub OAuth token.

### Get Auth URL
```bash
bun run auth url
```
Returns the authentication URL for CLI users.

## Token Storage

GitHub OAuth tokens are stored securely using:

1. **OS Keyring** (if available): Uses the system's secure keyring
2. **File Storage** (fallback): Stores in `~/.gh_oauth_token` with restricted permissions

## Development Setup

1. Start the web server:
   ```bash
   bun run dev
   ```

2. In another terminal, test CLI authentication:
   ```bash
   bun run chat
   ```

3. Check authentication status:
   ```bash
   bun run auth:status
   ```

## Security Notes

- Tokens are stored with restricted file permissions (600)
- The system falls back to file storage if keyring is unavailable
- Tokens are automatically refreshed through Clerk's OAuth flow
- CLI tokens are separate from web session tokens

## Troubleshooting

### "Not authenticated" error
- Run `bun run auth:status` to check current status
- Ensure the web server is running (`bun run dev`)
- Try logging out and back in: `bun run auth:logout`

### Browser doesn't open automatically
- The CLI will show the URL to visit manually
- Ensure you're using a supported platform (Windows, macOS, Linux)

### Token not saving
- Check that the web server is running on port 3000
- Verify Clerk configuration in your environment
- Check browser console for any errors during OAuth flow
