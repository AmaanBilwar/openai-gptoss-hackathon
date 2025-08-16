# Intelligent Commit Splitting

This feature provides AI-powered intelligent commit splitting that analyzes your uncommitted changes and groups them into logical, meaningful commits using semantic analysis.

## Overview

The intelligent commit splitting feature uses:
- **Supermemory AI** for semantic analysis of file changes
- **Cerebras LLM** for generating conventional commit messages
- **Git operations** for executing the commit splitting

## Features

### 1. Semantic Analysis
- Analyzes file content before and after changes
- Groups related changes based on functionality and purpose
- Uses AI to understand the broader context of changes

### 2. Intelligent Grouping
- Groups changes by feature, component, or logical separation
- Considers file paths, extensions, and content relationships
- Creates meaningful commit groups that follow best practices

### 3. Conventional Commit Messages
- Generates commit messages following conventional commit format
- Focuses on business value and user impact
- Uses semantic context to create descriptive messages

### 4. Automatic Threshold Detection
- Automatically triggers intelligent splitting for large changes (>1000 lines)
- Provides analysis of change size and complexity
- Recommends appropriate commit strategy

## Setup

### Environment Variables

Add these environment variables to your `.env` file:

```env
SUPERMEMORY_API_KEY=your_supermemory_api_key
CEREBRAS_API_KEY=your_cerebras_api_key
```

### Installation

The feature requires the `supermemory` package. Install it with:

```bash
npm install supermemory
```

## Usage

### Via Tool Calling

The intelligent commit splitting is available as tools in the GPT-OSS Tool Caller:

#### 1. Intelligent Commit Split
```typescript
// Analyze and split commits intelligently
await toolCaller.executeTool('intelligent_commit_split', {
  auto_push: false,  // Whether to push after splitting
  dry_run: true      // Whether to only analyze without creating commits
});
```

#### 2. Commit and Push with Threshold
```typescript
// Commit with automatic threshold checking
await toolCaller.executeTool('commit_and_push', {
  commit_message: 'Your commit message',
  auto_push: true,
  force_intelligent_split: false
});
```

#### 3. Check Changes Threshold
```typescript
// Check if changes exceed threshold
await toolCaller.executeTool('check_changes_threshold', {
  threshold: 1000  // Line threshold (default: 1000)
});
```

### Direct Usage

You can also use the IntelligentCommitSplitter directly:

```typescript
import { IntelligentCommitSplitter } from './src/backend/intelligentCommitSplitter';

const splitter = new IntelligentCommitSplitter(
  process.env.SUPERMEMORY_API_KEY!,
  process.env.CEREBRAS_API_KEY!
);

// Run analysis and create commits
const commitGroups = await splitter.runIntelligentSplitting(true);
```

### Testing

Run the test script to verify the feature works:

```bash
npm run test-intelligent-split
```

## How It Works

### 1. Change Detection
- Scans git working directory for uncommitted changes
- Identifies modified, added, and deleted files
- Extracts before/after content and diff information

### 2. Semantic Analysis
- Uploads file contents to Supermemory for analysis
- Queries for semantic relationships between changes
- Generates summaries of change patterns and purposes

### 3. Intelligent Grouping
- Groups files based on:
  - Directory structure (frontend, backend, docs, etc.)
  - File extensions (code, documentation, config)
  - Semantic relationships from AI analysis
- Creates logical commit groups

### 4. Commit Message Generation
- Uses Cerebras LLM to generate conventional commit messages
- Incorporates semantic analysis for context
- Follows conventional commit format (feat:, fix:, docs:, etc.)

### 5. Execution
- Creates backup branch before making changes
- Stages files for each commit group
- Creates commits with generated messages
- Optionally pushes to remote

## File Structure

```
src/backend/
├── intelligentCommitSplitter.ts    # Main intelligent commit splitter
├── supermemoryClient.ts            # Supermemory API client
├── cerebrasLLM.ts                  # Cerebras LLM client
├── toolCalling.ts                  # Tool calling integration
├── types.ts                        # Type definitions
└── test-intelligent-split.ts       # Test script
```

## Configuration

### Threshold Settings
- Default threshold: 1000 lines
- Configurable via `check_changes_threshold` tool
- Automatic intelligent splitting for large changes

### Grouping Rules
- **Frontend**: `frontend/`, `client/`, `ui/`, `src/`, `components/`
- **Backend**: `backend/`, `server/`, `api/`, `services/`
- **Documentation**: `docs/`, `documentation/`, `readme/`
- **Testing**: `tests/`, `test/`, `spec/`
- **Configuration**: `config/`, `conf/`, `settings/`
- **Utilities**: `scripts/`, `tools/`, `utils/`

### File Extensions
- **Code**: `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.java`, `.cpp`, `.c`
- **Documentation**: `.md`, `.txt`, `.rst`
- **Configuration**: `.json`, `.yaml`, `.yml`, `.toml`, `.ini`

## Safety Features

### Backup Branch
- Creates backup branch before making changes
- Allows easy rollback if needed
- Provides rollback instructions

### Dry Run Mode
- Analyze changes without creating commits
- Preview commit groups and messages
- Safe testing of the feature

### Error Handling
- Graceful handling of API failures
- Cleanup of uploaded memories on errors
- Detailed error messages and suggestions

## Examples

### Example Output

```
🚀 Starting Intelligent Commit Splitting Analysis...
📊 Step 1: Extracting file changes...
Found 5 files with changes
📤 Step 2: Uploading to Supermemory for semantic analysis...
🔍 Step 3: Analyzing semantic relationships...
Identified 3 logical commit groups

📋 Commit Groups Identified:

1. frontend
   Title: feat: add user authentication UI components
   Description: Implement login form, registration form, and user profile components with proper validation and error handling
   Files: src/components/LoginForm.tsx, src/components/RegisterForm.tsx, src/components/UserProfile.tsx

2. backend
   Title: feat: implement authentication API endpoints
   Description: Add JWT-based authentication with login, register, and profile endpoints including proper error handling and validation
   Files: backend/auth/routes.ts, backend/auth/middleware.ts, backend/models/User.ts

3. configuration
   Title: chore: update environment configuration
   Description: Add authentication-related environment variables and update database configuration for user management
   Files: .env.example, config/database.ts
```

### Example Tool Usage

```typescript
// Check if changes need intelligent splitting
const thresholdCheck = await toolCaller.executeTool('check_changes_threshold', {});
if (thresholdCheck.exceeds_threshold) {
  // Trigger intelligent splitting
  await toolCaller.executeTool('intelligent_commit_split', {
    auto_push: true,
    dry_run: false
  });
} else {
  // Regular commit
  await toolCaller.executeTool('commit_and_push', {
    commit_message: 'feat: add new feature',
    auto_push: true
  });
}
```

## Troubleshooting

### Common Issues

1. **Missing API Keys**
   - Ensure `SUPERMEMORY_API_KEY` and `CEREBRAS_API_KEY` are set
   - Check environment variable names and values

2. **No Changes Detected**
   - Make sure you have uncommitted changes in your git repository
   - Check that you're in the correct directory

3. **Git Operations Fail**
   - Ensure you're in a git repository
   - Check git configuration and permissions
   - Verify remote repository access for pushing

4. **Memory Cleanup Issues**
   - The system automatically cleans up uploaded memories
   - Check Supermemory API access and quotas

### Debug Mode

Enable debug logging by setting the log level:

```typescript
// In your environment or configuration
process.env.DEBUG = 'true';
```

## Contributing

To extend the intelligent commit splitting feature:

1. **Add New Grouping Rules**: Modify `determineGroupKey()` in `intelligentCommitSplitter.ts`
2. **Enhance Semantic Analysis**: Update queries in `analyzeSemanticRelationships()`
3. **Improve Commit Messages**: Modify the prompt in `cerebrasLLM.ts`
4. **Add New Tools**: Extend the tools array in `toolCalling.ts`

## License

This feature is part of the Kite project and follows the same license terms.
