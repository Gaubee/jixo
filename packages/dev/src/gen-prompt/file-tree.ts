import path from "node:path";

interface FileTreeNode {
  children: Map<string, FileTreeNode>;
  isFile?: boolean;
}

// Helper to build the tree recursively
function buildTree(
  node: FileTreeNode,
  indentation: string, // This is the accumulated indentation for the current node's children
  outputLines: string[],
  expandDirectories: boolean,
) {
  const sortedChildren = Array.from(node.children.keys()).sort((a, b) => {
    const aIsFile = node.children.get(a)?.isFile || false;
    const bIsFile = node.children.get(b)?.isFile || false;
    if (aIsFile === bIsFile) return a.localeCompare(b);
    return aIsFile ? 1 : -1; // Directories first
  });

  sortedChildren.forEach((childName, index) => {
    const isLastChild = index === sortedChildren.length - 1;
    const childNode = node.children.get(childName)!;
    const branchSymbol = isLastChild ? "└── " : "├── ";

    outputLines.push(`${indentation}${branchSymbol}${childName}`);

    const nextIndentation = indentation + (isLastChild ? "    " : "│   ");

    if (childNode.children.size > 0 && expandDirectories) {
      buildTree(childNode, nextIndentation, outputLines, expandDirectories);
    }
  });
}

/**
 * Generates a string representation of a file tree from a list of file paths.
 * @param files - An array of file paths.
 * @param expandDirectories - Whether to recursively expand directories.
 * @returns A string formatted as a file tree.
 */
export function generateFileTree(files: string[], expandDirectories: boolean = true): string {
  if (files.length === 0) {
    return "";
  }

  const root: FileTreeNode = {children: new Map()};

  // Build the hierarchical structure
  files.forEach((file) => {
    const parts = file.split(path.sep);
    let current: FileTreeNode = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFilePart = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {children: new Map(), isFile: isFilePart});
      }
      const nextNode = current.children.get(part)!;

      if (!expandDirectories && !isFilePart) {
        nextNode.children = new Map();
        break;
      }
      current = nextNode;
    }
  });

  const outputLines: string[] = [];
  const sortedRootChildren = Array.from(root.children.keys()).sort((a, b) => {
    const aIsFile = root.children.get(a)?.isFile || false;
    const bIsFile = root.children.get(b)?.isFile || false;
    if (aIsFile === bIsFile) return a.localeCompare(b);
    return aIsFile ? 1 : -1; // Directories first
  });

  sortedRootChildren.forEach((childName, index) => {
    const isLastChild = index === sortedRootChildren.length - 1;
    const childNode = root.children.get(childName)!;
    const branchSymbol = isLastChild ? "└── " : "├── ";
    outputLines.push(`${branchSymbol}${childName}`);

    if (childNode.children.size > 0 && expandDirectories) {
      const nextPrefix = isLastChild ? "    " : "│   ";
      buildTree(childNode, nextPrefix, outputLines, expandDirectories);
    }
  });

  return outputLines.join("\n");
}
