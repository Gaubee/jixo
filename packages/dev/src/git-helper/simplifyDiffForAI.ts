/**
 * 简化一个标准的 diff 字符串，移除对 AI 无用的元数据以节省 token。
 * @param fullDiff - 一个完整的、标准的 git diff 输出字符串。
 * @returns 一个只包含 hunk 头和内容行的简化 diff 字符串。
 */
export const simplifyDiffForAI = (fullDiff: string): string => {
  // 正则表达式匹配所有需要移除的元数据行
  const metadataPattern = /^(diff --git|index |--- |\+\+\+ |(old|new|deleted) file mode )/;
  return fullDiff
    .split("\n")
    .filter((line) => !metadataPattern.test(line))
    .join("\n");
};
