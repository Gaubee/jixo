import { writeJson, writeMarkdown } from "@gaubee/nodekit";
import { str_trim_indent } from "@gaubee/util";
import fs from "node:fs";
import path from "node:path";
import type { JixoConfig } from "../config.js";
export const init = (dir: string) => {
  const jixoDirname = path.join(dir, ".jixo");
  /// 创建 .jixo 目录
  fs.mkdirSync(jixoDirname, { recursive: true });
  {
    const readmeTaskFilepath = path.join(jixoDirname, "readme.task.md");
    if (!fs.existsSync(readmeTaskFilepath)) {
      writeMarkdown(
        readmeTaskFilepath,
        str_trim_indent(`
    <!-- 您可以自定义 readme.md 文件的格式 -->
    请JIXO帮我生成或者追加 README 文件
    `),
        {
          agents: ["readme-writer"],
        }
      );
    }
  }
  /// 配置文件
  {
    const jixoConfigFilepath = path.join(jixoDirname, "jixo.config.json");
    if (!fs.existsSync(jixoConfigFilepath)) {
      writeJson(jixoConfigFilepath, {
        tasks: { type: "dir", dirname: ".jixo" },
      } satisfies JixoConfig);
    }
  }
  /// .jixo/.gitignore
  {
    const gitignoreFilepath = path.join(dir, ".gitignore");
    const gitignoreLines = (
      fs.existsSync(gitignoreFilepath)
        ? fs.readFileSync(gitignoreFilepath, "utf-8")
        : ""
    ).split(/\n+/);
    let changed = false;
    for (const line of ["*.memory.json","memory.json"]) {
      if (!gitignoreLines.includes(line)) {
        gitignoreLines.unshift(line);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(gitignoreFilepath, gitignoreLines.join("\n"));
    }
  }
};
