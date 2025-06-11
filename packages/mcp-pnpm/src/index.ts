import {McpServer, type RegisteredTool} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

// --- 核心安全执行函数 (使用 spawn) ---

/**
 * 安全地在指定目录下执行 pnpm 命令，并返回其输出。
 * 使用 `spawn` 而不是 `exec` 来避免命令注入漏洞。
 * 这个函数被导出是为了方便在测试中进行 mock。
 * @param args - The arguments array to pass to the pnpm command.
 * @param cwd - The Current Working Directory where the command should be executed.
 * @returns A promise resolving with the command's combined standard output and error.
 */
async function executePnpmCommand(args: string[], cwd?: string): Promise<string> {
  const displayCwd = cwd || process.cwd();
  // 注意：我们仍然在日志中 join(" ") 方便阅读，但这绝不意味着它在 shell 中被这样执行
  console.error(`[SPAWN CWD: ${displayCwd}] pnpm ${args.join(" ")}`);

  return new Promise((resolve, reject) => {
    const pnpm = spawn("pnpm", args, {
      cwd,
      shell: true, // 在 Windows 上是必要的，对 Unix-like 系统也安全
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    pnpm.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pnpm.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pnpm.on("error", (error) => {
      console.error(`[SPAWN ERROR] Failed to start "pnpm" command.`, error);
      reject(new Error(`Failed to start subprocess: ${error.message}. Is pnpm installed and in your PATH?`));
    });

    pnpm.on("close", (code) => {
      if (stderr && code === 0) {
        console.error(`[STDWARN] ${stderr}`);
      }

      if (code === 0) {
        resolve(stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`);
      } else {
        const errorMessage = `Command "pnpm ${args.join(" ")}" failed with exit code ${code}.\n--- STDERR ---\n${stderr}\n--- STDOUT ---\n${stdout}`;
        console.error(`[ERROR] ${errorMessage}`);
        reject(new Error(errorMessage));
      }
    });
  });
}

// --- Schema 和工具定义 ---

const baseInputSchema = {
  cwd: z.string().optional().describe("The working directory to run the command in. If not provided, it runs in the current directory."),
  extraArgs: z.array(z.string()).optional().describe("An array of extra command-line arguments to pass to pnpm. Example: ['--reporter=json']."),
};

const baseOutputSchema = {
  content: z
    .array(
      z.object({
        type: z.literal("text"),
        text: z.string().describe("The standard output (stdout) from the executed pnpm command."),
      }),
    )
    .describe("The result of the tool call, containing the command's output."),
};

// 1. 创建 MCP Server 实例
const server = new McpServer({
  name: "pnpm-tool-pro",
  version: "2.3.0", // 版本升级，体现可测试性
});

const registeredTools: {[key: string]: RegisteredTool} = {};

// 2. 直接使用 server.registerTool() 定义所有工具，调用的是新的 executePnpmCommand

registeredTools.install = server.registerTool(
  "install",
  {
    /* ... schema and metadata ... */ description: "Installs all dependencies for a project.",
    inputSchema: {
      ...baseInputSchema,
      frozenLockfile: z.boolean().optional().describe("If true, use `--frozen-lockfile`."),
      production: z.boolean().optional().describe("If true, install only production dependencies (`--prod`)."),
    },
    outputSchema: baseOutputSchema,
    annotations: {title: "Install Project Dependencies"},
  },
  async ({cwd, frozenLockfile, production, extraArgs}) => {
    const args = ["install"];
    if (frozenLockfile) args.push("--frozen-lockfile");
    if (production) args.push("--prod");
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args, cwd); // 注意：调用 pnpmApi 上的函数
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.add = server.registerTool(
  "add",
  {
    /* ... schema and metadata ... */ description: "Adds packages to project dependencies.",
    inputSchema: {
      ...baseInputSchema,
      packages: z.array(z.string()).min(1).describe("An array of packages to add, e.g., ['react', 'vitest@latest']."),
      dev: z.boolean().optional().describe("Install as a development dependency (`-D`)."),
      optional: z.boolean().optional().describe("Install as an optional dependency (`-O`)."),
      filter: z.string().optional().describe("Target a specific project in a workspace (`--filter <name>`)."),
    },
    outputSchema: baseOutputSchema,
    annotations: {title: "Add Packages"},
  },
  async ({cwd, packages, dev, optional, filter, extraArgs}) => {
    const args = [];
    if (filter) args.push("--filter", filter);
    args.push("add");
    if (dev) args.push("-D");
    if (optional) args.push("-O");
    args.push(...packages);
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args, cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.run = server.registerTool(
  "run",
  {
    /* ... schema and metadata ... */ description: "Executes a script defined in the project's `package.json`.",
    inputSchema: {
      ...baseInputSchema,
      script: z.string().describe("The name of the script to execute from `package.json`."),
      scriptArgs: z.array(z.string()).optional().describe("Arguments for the script. Will be passed after '--'."),
      filter: z.string().optional().describe("In a workspace, run the script only in the specified project."),
    },
    outputSchema: baseOutputSchema,
    annotations: {title: "Run a Project Script", destructiveHint: true},
  },
  async ({cwd, script, scriptArgs, filter, extraArgs}) => {
    const pkgPath = path.join(cwd || process.cwd(), "package.json");
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
      if (!pkg.scripts || !pkg.scripts[script]) {
        throw new Error(`Security check failed: Script "${script}" not found in ${pkgPath}.`);
      }
    } catch (e: any) {
      throw new Error(`Security check failed: Could not read or parse package.json at '${pkgPath}'. Original error: ${e.message}`);
    }
    const args = [];
    if (filter) args.push("--filter", filter);
    args.push("run", script);
    if (extraArgs) args.push(...extraArgs);
    if (scriptArgs && scriptArgs.length > 0) {
      args.push("--", ...scriptArgs);
    }
    const output = await pnpmApi.executePnpmCommand(args, cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.dlx = server.registerTool(
  "dlx",
  {
    /* ... schema and metadata ... */
    description: "Fetches and runs a package from the registry. The package name and its arguments must be provided as separate strings in an array.",
    inputSchema: {
      ...baseInputSchema,
      commandAndArgs: z.array(z.string()).min(1).describe("The package and its arguments as an array. Example: ['cowsay', 'Hello MCP!']"),
    },
    outputSchema: baseOutputSchema,
    annotations: {title: "Download and Execute Package", openWorldHint: true},
  },
  async ({cwd, commandAndArgs, extraArgs}) => {
    const args = ["dlx"];
    if (extraArgs) args.push(...extraArgs);
    args.push(...commandAndArgs);
    const output = await pnpmApi.executePnpmCommand(args, cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.create = server.registerTool(
  "create",
  {
    /* ... schema and metadata ... */ description: "Creates a new project from a starter kit.",
    inputSchema: {
      ...baseInputSchema,
      template: z.string().describe("The starter kit name, e.g., 'vite'."),
      templateArgs: z.array(z.string()).optional().describe("Arguments for the create command, e.g., ['my-app', '--template', 'react-ts']"),
    },
    outputSchema: baseOutputSchema,
    annotations: {title: "Create a New Project", openWorldHint: true},
  },
  async ({cwd, template, templateArgs, extraArgs}) => {
    const args = ["create", template];
    if (templateArgs) args.push(...templateArgs);
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args, cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.licenses = server.registerTool(
  "licenses",
  {
    /* ... schema and metadata ... */ description: "Checks and lists the licenses of installed packages.",
    inputSchema: {
      ...baseInputSchema,
      json: z.boolean().optional().describe("Output as a JSON object."),
      dev: z.boolean().optional().describe("Check only for development dependencies."),
      production: z.boolean().optional().describe("Check only for production dependencies."),
    },
    outputSchema: baseOutputSchema,
    annotations: {title: "List Package Licenses", readOnlyHint: true},
  },
  async ({cwd, json, dev, production, extraArgs}) => {
    const args = ["licenses", "list"];
    if (json) args.push("--json");
    if (dev) args.push("--dev");
    if (production) args.push("--prod");
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args, cwd);
    return {content: [{type: "text", text: output}]};
  },
);

// 3. 导出 API, 包含 executePnpmCommand
// **重要**: 这里的 pnpmApi 对象需要在所有 registerTool 调用之后定义,
// 因为 registerTool 的回调函数内部依赖于它。
export const pnpmApi = {
  server,
  tools: registeredTools,
  executePnpmCommand, // <--- 关键修改：重新导出以供测试
};

// 4. 主函数
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP pnpm tool server running on stdio. Ready for commands.");
}

// 5. 程序入口
if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("Fatal error in MCP pnpm tool server:", error);
    process.exit(1);
  });
}
