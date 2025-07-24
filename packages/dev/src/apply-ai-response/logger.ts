import {blue, bold, cyan, green, italic, magenta, red, underline, yellow} from "@gaubee/nodekit";
import {match} from "ts-pattern";
import type {DiffFileMode} from "./parser.js";

// --- 日志记录器 ---
export const logger = {
  info: (message: string) => console.log(cyan("[INFO]"), message),
  success: (message: string) => console.log(green("[SUCCESS]"), message),
  warn: (message: string) => console.log(yellow("[WARN]"), message),
  error: (message: string) => console.error(red("[ERROR]"), message),
  file: (filePath: string) => magenta(filePath),
  mode: (mode: DiffFileMode) =>
    match(mode)
      .with("add", () => green("❇️"))
      .with("modify", () => yellow("✏️"))
      .with("delete", () => red("❌"))
      .with("rename", () => red("🔄"))
      .with("rename+modify", () => red("🔀"))
      .exhaustive(),
  commitMessage: (title: string, detail: string) => {
    return [
      underline(bold(title)),
      "",
      detail
        // simple format
        .replace(/\*\*(.+?)\*\*/g, (_, v) => bold(v))
        .replace(/__(.+?)__/g, (_, v) => italic(v))
        .replace(/`(.+?)`/g, (_, v) => yellow(v)),
      blue("_".repeat(process.stdout.columns || 40)),
      "",
    ].join("\n");
  },
};
