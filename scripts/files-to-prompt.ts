import {FileEntry, walkFiles} from "@gaubee/nodekit";
import {func_debounce} from "@gaubee/util";
import watcher from "@parcel/watcher";
import {parseArgs} from "@std/cli/parse-args";
import {cyan, green} from "@std/fmt/colors";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import path from "node:path";
import process from "node:process";
export const parseConfig = (options: {_: (string | number)[]; outFile?: string}) => {
  const rootDir = path.resolve(process.cwd(), String(options._[0] ?? "."));
  const outFile = options.outFile ? path.resolve(process.cwd(), options.outFile) : path.resolve(rootDir, `../${path.parse(rootDir).name}.prompt-gen.md`);
  return {rootDir, outFile};
};
export const fileToPrompt = (config: ReturnType<typeof parseConfig>) => {
  const outMd = [
    //
    "> 以下是项目源文件的集合，我会同时提供行号，方便AI查看。行号使用 数字开头，使用`| `结尾\n",
    `> 当前目录: ${config.rootDir}\n`,
  ];
  const matchExt = new Set([".ts", ".mbt", ".md", ".json", ".py", ".txt"]);
  for (const entry of walkFiles(config.rootDir, {
    ignore: ["node_modules", "dist", "build", "bundle", "target", "coverage", "ai", "examples", "*.prompt-gen.md"],
    match: (entry) => {
      if (entry.isDirectory) {
        return true;
      }
      const ext = path.parse(entry.name).ext;
      return matchExt.has(ext);
    },
    deepth: Infinity,
  })) {
    outMd.push(`### ${entry.relativePath}`);
    outMd.push("````"); //+path.parse( entry.name).ext
    outMd.push(
      entry
        .readText()
        .split("\n")
        .map((line, i) => {
          const lineNo = `${i + 1}`.padStart(4, "0") + "| ";
          return lineNo + line;
        })
        .join("\n"),
    );
    outMd.push("````\n");
  }
  new FileEntry(config.outFile).write(outMd.join("\n"));
  console.log(cyan(`[${new Date().toLocaleTimeString()}]`), green(`✅ ${path.relative(process.cwd(), config.outFile)} `));
};

if (import_meta_ponyfill(import.meta).main) {
  const cliArgs = parseArgs(process.argv.slice(2), {
    string: ["outFile"],
    boolean: ["watch"],
  });
  const config = parseConfig(cliArgs);
  fileToPrompt(config);
  if (cliArgs.watch) {
    watcher.subscribe(
      config.rootDir,
      func_debounce(() => {
        fileToPrompt(config);
      }, 300),
    );
  }
}
