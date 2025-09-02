#!/usr/bin/env tsx

import { parseMarkdownToHtml, parseMarkdownToText, hasMarkdown } from '../markdownParser';

console.log('🧪 Testing Simple Markdown Parser\n');

const testContent = `# Hello World

This is a **bold** and *italic* text.

- Item 1
- Item 2

\`\`\`bash
echo "Hello World"
\`\`\`

Visit [GitHub](https://github.com) for more info.`;

console.log('📄 Test Content:');
console.log(testContent);

console.log('\n🔧 Parsed Results:');

const html = parseMarkdownToHtml(testContent);
console.log('\n🌐 HTML Output:');
console.log(html);

const text = parseMarkdownToText(testContent);
console.log('\n📝 Plain Text Output:');
console.log(text);

const hasMd = hasMarkdown(testContent);
console.log('\n🔍 Has Markdown:', hasMd);

console.log('\n✅ Test completed successfully!');
