# RAG Q&A System for Git Commits

A Retrieval-Augmented Generation (RAG) system that enables natural language Q&A over Git commits and pull requests using Convex DB, Hugging Face embeddings, and Cerebras LLM.

## Features

- **Vector Search**: Semantic search over commit hunks using BGE-M3 embeddings
- **LLM Integration**: Answer generation using Cerebras GPT-OSS-120B model
- **Caching**: Intelligent caching of Q&A responses
- **CLI Integration**: Seamless integration with existing chat CLI

## Architecture

```
GitHub API → Convex DB → Vector Search → Cerebras LLM → Cached Answers
```

## Environment Variables

```bash
# Required for RAG functionality
HF_TOKEN=xhf_...              # Hugging Face Inference API token
CEREBRAS_API_KEY=...          # Cerebras API key
GITHUB_TOKEN=...              # GitHub personal access token
```

## Usage

### CLI Commands

```bash
# Ask questions about commits
npm run chat
> ask commit AnandVishesh1301/developer_portfolio 981c582 "What changes were made?"

# Test RAG system
npx tsx src/backend/test-rag-final.ts
```

### API Endpoints

- `POST /api/actions/ask/askCommit` - Query commits with natural language
- `POST /api/actions/embed/embedHunks` - Generate embeddings for commit hunks

## Database Schema

- `repos` - Repository metadata
- `commits` - Commit information
- `hunks` - Code change hunks
- `embeddings_hunk` - Vector embeddings for semantic search
- `answers` - Cached Q&A responses

## Status

✅ **Working**: Hugging Face embeddings, Cerebras LLM, basic RAG flow  
🔄 **In Progress**: Vector search integration, automatic embedding generation  
📋 **TODO**: Webhook integration, PR support, advanced retrieval

## Testing

The system is tested with:
- Repository: `AnandVishesh1301/developer_portfolio`
- Commit: `981c582264949f25cebd64d152f44eb07b8f848d`

Run `npx tsx src/backend/test-rag-final.ts` to verify functionality.
