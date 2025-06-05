import {import_meta_ponyfill} from "import-meta-ponyfill";
import path from "node:path";
import {findChangedFilesSinceCommit} from "./find-changes.js";

// --- 使用示例 ---
async function test() {
  const messagePattern = "@jixo"; // 你要搜索的 commit message 内容
  const repoDir = "."; // Git 仓库的路径，默认为当前目录

  console.log(`Searching for changes since commit with message containing "${messagePattern}" in ${path.resolve(repoDir)}...`);
  const files = await findChangedFilesSinceCommit(messagePattern, repoDir);

  if (files.length > 0) {
    console.log("\nChanged files (relative to git root):");
  } else {
    console.log("\nNo changed files found based on the criteria.");
  }
  return files;
}
if (import_meta_ponyfill(import.meta).main) {
  const files = await test();
  console.log(files.map((file) => file.path));
}
