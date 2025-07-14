import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import type { Root, HTML } from 'mdast';

interface Position {
  start: { offset: number };
  end: { offset: number };
}

/**
 * Surgically removes HTML-style comments from a Markdown string
 * without reformatting the rest of the content.
 *
 * @param markdownContent The original Markdown string.
 * @returns Markdown string with only comments removed.
 */
export function removeMarkdownComments(markdownContent: string): string {
  if (!markdownContent) {
    return '';
  }

  // 1. 解析 Markdown 获取带位置信息的 AST
  // 我们使用更底层的 fromMarkdown，因为它默认就提供位置信息
  const tree = fromMarkdown(markdownContent) as Root;

  const commentIntervals: { start: number; end: number }[] = [];

  // 2. 遍历 AST，收集所有注释节点的位置
  visit(tree, 'html', (node: HTML) => {
    if (node.value.startsWith('<!--')) {
      const position = node.position as Position;
      if (position?.start?.offset !== undefined && position?.end?.offset !== undefined) {
        commentIntervals.push({
          start: position.start.offset,
          end: position.end.offset,
        });
      }
    }
  });

  if (commentIntervals.length === 0) {
    return markdownContent;
  }

  // 3. 从后往前，根据位置信息从原始字符串中移除注释
  // 从后往前操作是为了避免前面的删除操作影响后面区间的索引
  let result = markdownContent;
  for (let i = commentIntervals.length - 1; i >= 0; i--) {
    const { start, end } = commentIntervals[i];
    result = result.slice(0, start) + result.slice(end);
  }

  return result;
}
