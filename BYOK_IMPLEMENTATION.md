# Bring Your Own API Key (BYOK) Implementation

This document describes the implementation of the Bring Your Own API Key (BYOK) system for Kite, allowing users to use their own API keys instead of relying on hardcoded environment variables.

## Overview

The BYOK system allows users to:
1. Add their own API keys through the Kite settings page
2. Have the Go CLI and TypeScript backend use these user-provided API keys
3. Fall back to environment variables when user API keys are not available

## Architecture

### Database Schema
- **apiKeys table**: Stores user API keys with encryption
  - `userId`: Clerk user ID
  - `provider`: API provider (e.g., "cerebras", "openai")
  - `keyName`: User-friendly name for the key
  - `encryptedKey`: Encrypted API key
  - `isActive`: Whether the key is currently active

### Backend Changes

#### Convex Functions (kite/convex/users.ts)
- `getUserApiKeyByProvider(provider)`: Get a specific user's API key by provider
- `getActiveUserApiKeys()`: Get all active API keys for a user
- `saveApiKey(provider, keyName, apiKey)`: Save or update an API key
- `deleteApiKey(apiKeyId)`: Delete an API key
- `toggleApiKeyStatus(apiKeyId, isActive)`: Toggle API key active status

#### API Server (kite/src/backend/api-server.ts)
- `getUserApiKeys()`: Helper function to fetch user API keys from Convex
- `/api/user/api-keys/:provider`: Endpoint to get user's API key by provider
- Updated tool execution and chat endpoints to use user API keys

#### Tool Calling (kite/src/backend/toolCalling.ts)
- `GPTOSSToolCaller` now accepts `userApiKeys` parameter
- `getApiKey(provider)`: Method to get API key, preferring user keys over env vars
- Updated all API key usage to use the new method

### Go CLI Changes

#### Backend Client (tui/tools.go)
- `getUserApiKey(provider)`: Fetches user's API key from backend API

#### Cerebras Client (tui/cerebras.go)
- `NewCerebrasClient()`: Now tries to get API key from backend first, falls back to env var
- Provides clear feedback about which API key source is being used

## Usage Flow

### For Users
1. **Add API Key**: Go to Kite settings → API Keys → Add Cerebras API Key
2. **Use CLI**: Run `go run .` - CLI will automatically use the user's API key
3. **Fallback**: If no user API key, CLI will use `CEREBRAS_API_KEY` environment variable

### For Developers
1. **Environment Setup**: `CEREBRAS_API_KEY` is now optional (warns if missing)
2. **User API Keys**: Automatically fetched and used when available
3. **Backward Compatibility**: Still works with environment variables

## Security Considerations

### Current Implementation
- API keys are stored as plain text in the database (TODO: implement encryption)
- API keys are transmitted over HTTPS
- User authentication required to access API keys

### Future Improvements
- Implement proper encryption for stored API keys
- Add API key rotation capabilities
- Add usage tracking and limits per API key

## Testing

### Manual Testing
1. Start the Kite backend: `cd kite && npm run dev`
2. Add a Cerebras API key in the settings page
3. Run the Go CLI: `cd tui && go run .`
4. Verify the CLI uses the user's API key (check console output)

### Environment Variables
- `CEREBRAS_API_KEY`: Fallback API key (optional)
- `BACKEND_URL`: Backend URL for CLI (defaults to http://localhost:3001)

## Migration Guide

### For Existing Users
- No changes required - environment variables still work
- Users can optionally add their own API keys through settings

### For Developers
- Update any direct `CEREBRAS_API_KEY` usage to use `getApiKey('cerebras')`
- Consider implementing proper encryption for production use

## API Endpoints

### New Endpoints
- `GET /api/user/api-keys/:provider` - Get user's API key by provider
- `POST /api/user/api-keys` - Save user's API key (via Convex)
- `DELETE /api/user/api-keys/:id` - Delete user's API key (via Convex)

### Updated Endpoints
- `POST /api/tools/execute` - Now uses user API keys when available
- `POST /chat` - Now uses user API keys when available

## Error Handling

### API Key Not Found
- CLI: Falls back to environment variable
- Backend: Returns appropriate error message

### Authentication Required
- CLI: Prompts user to authenticate
- Backend: Returns 401 Unauthorized

### Invalid API Key
- Both CLI and backend provide clear error messages
- Suggests checking API key validity

## Future Enhancements

1. **Encryption**: Implement proper encryption for stored API keys
2. **Multiple Providers**: Support for OpenAI, Anthropic, etc.
3. **Usage Tracking**: Track API key usage and costs
4. **Key Rotation**: Automatic API key rotation
5. **Team Management**: Share API keys across team members
6. **Rate Limiting**: Per-user rate limiting based on API key limits
