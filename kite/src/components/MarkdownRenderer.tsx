"use client";

import React, { useEffect, useState } from "react";
import { parseMarkdownToHtml, hasMarkdown } from "../backend/markdownParser";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showRaw?: boolean;
}

/**
 * React component for rendering markdown content from LLM responses
 * Uses the markdown-it parser to convert markdown to HTML
 */
export function MarkdownRenderer({
  content,
  className = "",
  showRaw = false,
}: MarkdownRendererProps) {
  const [parsedHtml, setParsedHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!content) {
      setParsedHtml("");
      setIsLoading(false);
      return;
    }

    try {
      // Parse markdown to HTML
      const html = parseMarkdownToHtml(content);
      setParsedHtml(html);
    } catch (error) {
      console.error("Error parsing markdown:", error);
      // Fallback to plain text if parsing fails
      setParsedHtml(content.replace(/\n/g, "<br>"));
    } finally {
      setIsLoading(false);
    }
  }, [content]);

  if (isLoading) {
    return <div className={`animate-pulse ${className}`}>Loading...</div>;
  }

  if (showRaw) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Raw Content:
          </h3>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
            {content}
          </pre>
        </div>
        <div className="bg-white border p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Parsed HTML:
          </h3>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
            {parsedHtml}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: parsedHtml }}
    />
  );
}

/**
 * Simple markdown preview component for development/testing
 */
export function MarkdownPreview() {
  const [input, setInput] = useState<string>(`# Welcome to Kite! 🚀

I'm your **AI-powered GitHub assistant** that can help you:

- 📁 **List repositories** - See all your GitHub repos
- 🔄 **Manage pull requests** - Create, update, and review PRs  
- 📝 **Generate commit messages** - Get intelligent commit suggestions

## Getting Started

To begin, you can ask me to:
1. List your repositories
2. Show pull requests for a specific repo
3. Get details about a particular PR

\`\`\`bash
# Example command
git status
\`\`\`

*Let me know what you'd like to work on!*`);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Markdown Parser Preview</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Input Markdown:
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-96 p-3 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder="Enter markdown content here..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rendered Output:
          </label>
          <div className="h-96 p-3 border border-gray-300 rounded-lg overflow-y-auto bg-white">
            <MarkdownRenderer content={input} />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <MarkdownRenderer content={input} showRaw={true} />
      </div>
    </div>
  );
}

/**
 * Chat message component that renders LLM responses with markdown
 */
export function ChatMessage({
  content,
  isUser = false,
  className = "",
}: {
  content: string;
  isUser?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} ${className}`}
    >
      <div
        className={`max-w-3xl rounded-lg p-4 ${
          isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <MarkdownRenderer content={content} />
        )}
      </div>
    </div>
  );
}

/**
 * Streaming chat message component for real-time LLM responses
 */
export function StreamingChatMessage({
  content,
  isComplete = false,
  className = "",
}: {
  content: string;
  isComplete?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-gray-100 rounded-lg p-4 ${className}`}>
      <MarkdownRenderer content={content} />
      {!isComplete && (
        <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
      )}
    </div>
  );
}
