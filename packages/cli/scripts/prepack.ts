// scripts/prepack.mjs
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
    // 1. 检查 assets 是否存在且为符号链接
    const stats = await fs.lstat(assetsPath);
    if (!stats.isSymbolicLink()) {
      console.log("✅ assets is not a symbolic link. Nothing to do. Skipping prepack script.");
      return;
    }
    console.log(" assets is a symbolic link. Proceeding with prepack...");

    // 2. 将 assets 重命名为 .assets.bak
    console.log(`Renaming symbolic link "${assetsPath}" to "${backupPath}"...`);
    await fs.rename(assetsPath, backupPath);

    // 3. 读取符号链接指向的真实路径
    const realPath = await fs.readlink(backupPath);
    console.log(`Symbolic link points to: "${realPath}"`);

    // 4. 将真实路径的内容复制到新的 assets 文件夹
    console.log(`Copying content from "${realPath}" to a new "assets" directory...`);
    await fs.cp(realPath, assetsPath, {
      recursive: true,
      dereference: true,
    });

    console.log("✅ Prepack script finished successfully.");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(" assets directory or link does not exist. Skipping prepack script.");
    } else {
      console.error("❌ Error during prepack script:", error);
      // 抛出错误，终止 npm publish 过程
      process.exit(1);
    }
  }
}

main();
