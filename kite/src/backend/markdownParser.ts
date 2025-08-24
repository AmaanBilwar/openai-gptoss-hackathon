import MarkdownIt from 'markdown-it';

/**
 * Simple markdown parser using markdown-it
 * Configured for LLM responses with sensible defaults
 */
const md = new MarkdownIt({
  html: false,           // Disable HTML for security
  breaks: true,          // Convert line breaks to <br> for better formatting
  linkify: true,         // Auto-convert URLs to links
  typographer: true,     // Enable smart quotes and typography
});

/**
 * Parse markdown content to HTML
 */
export function parseMarkdownToHtml(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  return md.render(content.trim());
}

/**
 * Parse markdown content to plain text (removes markdown syntax)
 */
export function parseMarkdownToText(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Simple regex-based markdown removal
  let text = content.trim();
  
  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  
  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');
  
  // Remove headers
  text = text.replace(/^#{1,6}\s+/gm, '');
  
  // Remove bold/italic
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  
  // Remove strikethrough
  text = text.replace(/~~([^~]+)~~/g, '$1');
  
  // Remove links (keep text)
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  
  // Remove horizontal rules
  text = text.replace(/^---+$/gm, '');
  
  // Clean up list markers
  text = text.replace(/^[-*+]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');
  
  // Clean up blockquotes
  text = text.replace(/^>\s+/gm, '');
  
  // Clean up table syntax
  text = text.replace(/^\|.*\|$/gm, '');
  
  // Normalize whitespace
  text = text.replace(/\n\s*\n/g, '\n\n');
  
  return text.trim();
}

/**
 * Check if content contains markdown syntax
 */
export function hasMarkdown(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }
  
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers
    /\*\*.*?\*\*/,           // Bold
    /\*.*?\*/,               // Italic
    /`.*?`/,                 // Inline code
    /```[\s\S]*?```/,        // Code blocks
    /^[-*+]\s+/m,            // Unordered lists
    /^\d+\.\s+/m,            // Ordered lists
    /^>\s+/m,                // Blockquotes
    /\[.*?\]\(.*?\)/,        // Links
    /!\[.*?\]\(.*?\)/,       // Images
    /^\|.*\|$/m,             // Tables
    /~~.*?~~/,               // Strikethrough
    /^---+$/m,               // Horizontal rules
  ];
  
  return markdownPatterns.some(pattern => pattern.test(content));
}
