# Markdown Parser Usage

This project uses **markdown-it** to parse LLM responses. The implementation is simple and direct - no unnecessary wrappers!

## 🚀 Quick Start

```typescript
import { parseMarkdownToHtml, parseMarkdownToText, hasMarkdown } from './src/backend/markdownParser';

// Parse markdown to HTML
const html = parseMarkdownToHtml('# Hello **World**!');
// Output: "<h1>Hello <strong>World</strong>!</h1>"

// Parse markdown to plain text (removes markdown syntax)
const text = parseMarkdownToText('# Hello **World**!');
// Output: "Hello World!"

// Check if content contains markdown
const hasMd = hasMarkdown('# Hello **World**!');
// Output: true
```

## 📝 Configuration

The markdown parser is configured with sensible defaults for LLM responses:

- **HTML disabled** for security
- **Line breaks converted** to `<br>` for better formatting
- **URLs auto-linked** for convenience
- **Typography enabled** for smart quotes

## 🧪 Testing

Run the test to verify everything works:

```bash
bun run test-markdown
```

## 🎯 Use Cases

### 1. CLI Responses
```typescript
// In chat.ts - parse assistant responses
const parsedContent = parseMarkdownToText(assistantContent);
messages.push({
  role: 'assistant',
  content: parsedContent
});
```

### 2. Web Interface
```tsx
// In React components
import { MarkdownRenderer } from './components/MarkdownRenderer';

<MarkdownRenderer content={llmResponse} />
```

### 3. Tool Results
```typescript
// In toolCalling.ts - parse streaming responses
const parsedContent = parseMarkdownToText(message.content);
yield parsedContent;
```

## ✨ Features

- **Simple API**: Just 3 functions
- **Security**: HTML disabled by default
- **Performance**: Direct markdown-it usage
- **Flexibility**: Easy to extend if needed

## 📚 Based on markdown-it

This implementation uses the official [markdown-it](https://github.com/markdown-it/markdown-it) library with CommonMark compliance and extensive plugin support.

No need to reinvent the wheel! 🎯
