import { describe, it, expect } from 'vitest';
import { removeMarkdownComments } from './markdown-remove-comment.js';

describe('removeMarkdownComments', () => {
  it('should remove a simple single-line HTML comment', () => {
    const input = 'Hello, <!-- this is a comment -->world!';
    const expected = 'Hello, world!';
    expect(removeMarkdownComments(input)).toBe(expected);
  });

  it('should remove a multi-line HTML comment', () => {
    const input = `
# Title
<!-- 
  This is a multi-line comment.
-->
This is the content.`.trim();
    const expected = `# Title\n\nThis is the content.`;
    expect(removeMarkdownComments(input)).toBe(expected);
  });

  // --- 测试修复 1: 不再与原始 input 比较 ---
  it('should not change the content if there are no comments (but may reformat)', () => {
    const input = '# Hello\nThis is a paragraph with `inline code`.';
    const expected = '# Hello\nThis is a paragraph with `inline code`.';
    expect(removeMarkdownComments(input)).toBe(expected);
  });

  // --- 测试修复 2: 同样，不与原始 input 比较 ---
  it('should NOT remove comment-like syntax inside a fenced code block', () => {
    const input = `
Some text before.
\`\`\`xml
<!-- This is valid XML, not a Markdown comment -->
<data>
  <item>Value</item>
</data>
\`\`\`
Some text after.`.trim();
    // 预料到 remark 会标准化段落间的空行
    const expected = `Some text before.\n\`\`\`xml\n<!-- This is valid XML, not a Markdown comment -->\n<data>\n  <item>Value</item>\n</data>\n\`\`\`\nSome text after.`;
    expect(removeMarkdownComments(input)).toBe(expected);
  });
  
  it('should NOT remove comment-like syntax inside an inline code span', () => {
    const input = 'Do not remove this: `<!-- fake comment -->`.';
    const expected = 'Do not remove this: `<!-- fake comment -->`.';
    expect(removeMarkdownComments(input)).toBe(expected);
  });

  it('should handle multiple comments scattered throughout the document', () => {
    const input = `
First paragraph. <!-- comment 1 -->
## Sub-heading
<!-- comment 2 -->
Another paragraph.
`.trim();
    const expected = `First paragraph. \n## Sub-heading\n\nAnother paragraph.`;
    expect(removeMarkdownComments(input)).toBe(expected);
  });

  it('should return an empty string if the input is empty', () => {
    expect(removeMarkdownComments('')).toBe('');
  });

  it('should return an empty string if the input only contains a comment', () => {
    const input = '<!-- only a comment -->';
    expect(removeMarkdownComments(input)).toBe('');
  });

  // --- 测试修复 3: 使用配置好的列表符号 ---
  it('should handle comments adjacent to other markdown elements', () => {
    const input = `
- List item 1<!--comment-->
- List item 2`.trim();
    // 因为我们配置了 bullet: '-', 所以期望输出也是 '-'
    const expected = `- List item 1\n- List item 2`;
    expect(removeMarkdownComments(input)).toBe(expected);
  });
});