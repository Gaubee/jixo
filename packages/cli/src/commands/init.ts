import {writeJson, writeMarkdown, writeText} from "@gaubee/nodekit";
import {str_trim_indent} from "@gaubee/util";
import fs from "node:fs";
import path from "node:path";
import type {JixoConfig} from "../config.js";
import {safeEnv} from "../env.js";
export const init = (dir: string) => {
  {
    const jixoDirname = path.join(dir, ".jixo");
    /// 创建 .jixo 目录
    fs.mkdirSync(jixoDirname, {recursive: true});
    /// .jixo/readme.job.md
    const readmeTaskFilepath = path.join(jixoDirname, "readme.job.md");
    if (!fs.existsSync(readmeTaskFilepath)) {
      writeMarkdown(
        readmeTaskFilepath,
        str_trim_indent(`
        <!-- 您可以自定义 readme.md 文件的格式 -->
        请JIXO帮我生成或者追加 README 文件
        `),
        {
          agents: ["readme-writer"],
        },
      );
    }
    /// .jixo/.gitignore
    const gitignoreFilepath = path.join(jixoDirname, ".gitignore");
    addRulesToGitIgnore(gitignoreFilepath, ["*.log.jsonl", "*.log.jsonl.txt"]);
  }
  /// jixo.config.json
  {
    const jixoConfigFilepath = path.join(dir, "jixo.config.json");
    if (!fs.existsSync(jixoConfigFilepath)) {
      writeJson(jixoConfigFilepath, {
        tasks: {type: "dir", dirname: ".jixo"},
      } satisfies JixoConfig);
    }
  }
  /// .jixo.env
  {
    const jixoEnvFilepath = path.join(dir, ".jixo.env");
    if (!fs.existsSync(jixoEnvFilepath)) {
      writeText(
        jixoEnvFilepath,
        Object.keys(safeEnv)
          .filter((key) => key.startsWith("JIXO_"))
          .map((key) => `${key}=""`)
          .join("\n"),
      );
    }
  }
  /// .gitignore
  {
    const gitignoreFilepath = path.join(dir, ".gitignore");
    addRulesToGitIgnore(gitignoreFilepath, ["*.memory.json", "memory.json", ".jixo.env"]);
  }
};

const addRulesToGitIgnore = (gitignoreFilepath: string, rules: string[]) => {
  const gitignoreLines = (fs.existsSync(gitignoreFilepath) ? fs.readFileSync(gitignoreFilepath, "utf-8") : "").split(/\n+/);
  let changed = false;
  for (const line of rules) {
    if (!gitignoreLines.includes(line)) {
      gitignoreLines.unshift(line);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(gitignoreFilepath, gitignoreLines.join("\n"));
  }
};
