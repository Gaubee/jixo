// scripts/postpack.mjs
import fs from "fs/promises";
import path from "path";
import {fileURLToPath} from "url";

// 获取当前脚本所在目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 项目根目录
const projectRoot = path.resolve(__dirname, "..");

// 定义路径
const assetsPath = path.join(projectRoot, "assets");
const backupPath = path.join(projectRoot, ".assets.bak");

async function main() {
  try {
    // 1. 检查备份 .assets.bak 是否存在
    await fs.access(backupPath);
    console.log("Backup .assets.bak found. Proceeding with postpack cleanup...");

    // 2. 删除 prepack 脚本创建的 assets 文件夹
    console.log(`Removing copied directory "${assetsPath}"...`);
    await fs.rm(assetsPath, {recursive: true, force: true});

    // 3. 将 .assets.bak 重命名回 assets
    console.log(`Restoring symbolic link by renaming "${backupPath}" to "${assetsPath}"...`);
    await fs.rename(backupPath, assetsPath);

    console.log("✅ Postpack script finished successfully. Workspace cleaned up.");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("No .assets.bak found. Nothing to clean up. Skipping postpack script.");
    } else {
      console.error("❌ Error during postpack script:", error);
      // 这里不建议 process.exit(1)，因为包已经打好了，这只是清理步骤
    }
  }
}

main();
