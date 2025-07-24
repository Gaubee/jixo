import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import packageJson from "../package.json" with {type: "json"};

export const runCli = async (args: string[] = process.argv) => {
  let cli = yargs(hideBin(args)).scriptName("jixo").version(packageJson.version).demandCommand(1, "You need at least one command before moving on").strict().help();

  // 动态加载命令
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const commandsDir = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandsDir).filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

  for (const file of commandFiles) {
    const commandModule = await import(path.join(commandsDir, file));
    // 假设每个模块导出一个或多个 yargs 命令模块
    for (const key in commandModule) {
      if (typeof commandModule[key] === "object" && commandModule[key].command) {
        cli = cli.command(commandModule[key]);
      }
    }
  }

  const argv = await cli.parse();

  // 如果没有命令被执行，显示帮助信息
  if (argv._.length === 0) {
    cli.showHelp();
    console.log(" " + "─".repeat(Math.max(4, process.stdout.columns - 2)));
  }
};
