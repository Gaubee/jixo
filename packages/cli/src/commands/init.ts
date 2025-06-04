import {writeJson, writeMarkdown} from "@gaubee/nodekit";
import {str_trim_indent} from "@gaubee/util";
import fs from "node:fs";
import path from "node:path";
import type {JixoConfig} from "../config";
export const init = (dir: string) => {
  const jixoDirname = path.join(dir, ".jixo");
  /// 创建 .jixo 目录
  fs.mkdirSync(jixoDirname, {recursive: true});
  writeMarkdown(
    path.join(jixoDirname, "readme.task.md"),
    str_trim_indent(`
    <!-- 您可以自定义 readme.md 文件的格式 -->
    `),
    {
      agents: ["readme-writer"],
    },
  );
  /// 配置文件
  writeJson(path.join(jixoDirname, "jixo.config.json"), {
    tasks: {type: "dir", dirname: ".jixo"},
  } satisfies JixoConfig);
  /// .gitignore
  {
    const gitignoreFilepath = path.join(jixoDirname, ".gitignore");
    const gitignoreLines = (fs.existsSync(gitignoreFilepath) ? fs.readFileSync(gitignoreFilepath, "utf-8") : "").split(/\n+/);
    let changed = false;
    for (const line of [".jixo-memory.md"]) {
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
