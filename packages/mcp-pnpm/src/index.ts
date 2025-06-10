import {McpServer, type RegisteredTool} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {exec} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {promisify} from "node:util";
import {z} from "zod";

const execAsync = promisify(exec);

// --- 核心函数与 Schema 定义 ---

/**
 * 安全地在指定目录下执行 pnpm 命令，并返回其输出。
 * @param command - The pnpm command and arguments to execute.
 * @param cwd - The Current Working Directory where the command should be executed.
 * @returns A promise resolving with the command's standard output.
 */
async function executePnpmCommand(command: string, cwd?: string): Promise<string> {
  const options = {cwd};
  const displayCwd = cwd || process.cwd();
  try {
    console.error(`[EXEC CWD: ${displayCwd}] pnpm ${command}`);
    const {stdout, stderr} = await execAsync(`pnpm ${command}`, options);
    if (stderr) {
      console.error(`[STDERR] ${stderr}`);
    }
    return stdout || `Command "pnpm ${command}" executed successfully.`;
  } catch (error: any) {
    console.error(`[ERROR CWD: ${displayCwd}] Failed to execute "pnpm ${command}":`, error);
    throw new Error(`Failed to execute command: "pnpm ${command}".\nError: ${error.stderr || error.stdout || error.message}`);
  }
}

/**
 * 定义所有工具共有的基础输入参数。
 * 这确保了所有工具都支持在特定目录下执行，并能接收额外的 CLI 参数。
 */
const baseInputSchema = {
  cwd: z.string().optional().describe("The working directory to run the command in. If not provided, it runs in the current directory."),
  extraArgs: z.array(z.string()).optional().describe("An array of any extra command-line arguments to pass directly to pnpm. For example, ['--reporter=json']."),
};

/**
 * 定义所有工具共有的标准输出 Schema。
 * 所有工具的输出都将是包含执行结果文本的单一 text content。
 */
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
  version: "2.0.0", // 版本升级，体现重大重构
});

const registeredTools: {[key: string]: RegisteredTool} = {};

// 2. 使用 server.registerTool() 定义所有工具，并提供丰富的元数据

registeredTools.install = server.registerTool(
  "install",
  {
    description: "Installs all dependencies for a project. This is equivalent to running `pnpm install`. It's the primary command for setting up a repository after cloning.",
    inputSchema: {
      ...baseInputSchema,
      frozenLockfile: z
        .boolean()
        .optional()
        .describe("If true, pnpm doesn't generate a lockfile and fails if the lockfile is out of sync (`--frozen-lockfile`). Essential for CI environments."),
      production: z.boolean().optional().describe("If true, install only production dependencies (`--prod`)."),
    },
    outputSchema: baseOutputSchema,
    annotations: {
      title: "Install Project Dependencies",
      readOnlyHint: false, // This command modifies the node_modules directory.
      destructiveHint: false, // It's additive, not destructive.
      idempotentHint: false, // Running it again might fetch new package versions.
    },
  },
  async ({cwd, frozenLockfile, production, extraArgs}) => {
    const args = ["install"];
    if (frozenLockfile) args.push("--frozen-lockfile");
    if (production) args.push("--prod");
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args.join(" "), cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.add = server.registerTool(
  "add",
  {
    description: "Adds one or more packages to the `dependencies`, `devDependencies`, or `optionalDependencies` of a project.",
    inputSchema: {
      ...baseInputSchema,
      packages: z.array(z.string()).min(1).describe("An array of packages to add. Can include versions and JSR specifiers, e.g., ['react', 'vitest@latest', 'jsr:@scope/pkg']."),
      dev: z.boolean().optional().describe("Install as a development dependency (`-D`)."),
      optional: z.boolean().optional().describe("Install as an optional dependency (`-O`)."),
      filter: z.string().optional().describe("Target a specific project in a workspace (`--filter <name>`)."),
    },
    outputSchema: baseOutputSchema,
    annotations: {
      title: "Add Packages to Dependencies",
      readOnlyHint: false, // Modifies package.json and node_modules.
      destructiveHint: false, // Additive operation.
    },
  },
  async ({cwd, packages, dev, optional, filter, extraArgs}) => {
    const args = [];
    if (filter) args.push(`--filter ${filter}`);
    args.push("add");
    if (dev) args.push("-D");
    if (optional) args.push("-O");
    args.push(...packages);
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args.join(" "), cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.run = server.registerTool(
  "run",
  {
    description: "Executes a script defined in the project's `package.json` file. This is the standard way to run build steps, tests, or other custom project commands.",
    inputSchema: {
      ...baseInputSchema,
      script: z.string().describe("The name of the script to execute from the `scripts` section of `package.json`."),
      args: z.array(z.string()).optional().describe("Arguments to be passed to the executed script. They will be appended after '--'."),
      filter: z.string().optional().describe("In a workspace, run the script only in the specified project."),
    },
    outputSchema: baseOutputSchema,
    annotations: {
      title: "Run a Project Script",
      readOnlyHint: false, // Scripts can have side effects.
      destructiveHint: true, // A 'clean' script could be destructive. Assume the worst case.
    },
  },
  async ({cwd, script, args, filter, extraArgs}) => {
    const pkgPath = cwd ? path.join(cwd, "package.json") : "package.json";
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    } catch (e) {
      throw new Error(`Security check failed: Could not read or parse package.json at '${pkgPath}'.`);
    }
    if (!pkg.scripts || !pkg.scripts[script]) {
      throw new Error(`Security check failed: Script "${script}" not found in package.json's "scripts" section at '${pkgPath}'.`);
    }
    const commandArgs = [];
    if (filter) commandArgs.push(`--filter ${filter}`);
    commandArgs.push(`run ${script}`);
    if (args && args.length > 0) commandArgs.push("--", ...args);
    if (extraArgs) commandArgs.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(commandArgs.join(" "), cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.dlx = server.registerTool(
  "dlx",
  {
    description:
      "Fetches a package from the registry and runs its default command binary. This is useful for running one-off commands without installing packages globally, e.g., `pnpm dlx cowsay`.",
    inputSchema: {
      ...baseInputSchema,
      command: z.string().describe("The package and command to execute, e.g., 'cowsay \"Hello\"' or 'create-vite@latest my-app'."),
    },
    outputSchema: baseOutputSchema,
    annotations: {
      title: "Download and Execute a Package",
      readOnlyHint: false, // Can create files or have other side effects.
      openWorldHint: true, // Fetches packages from the internet.
    },
  },
  async ({cwd, command, extraArgs}) => {
    const args = ["dlx", command];
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args.join(" "), cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.create = server.registerTool(
  "create",
  {
    description: "Creates a new project from a starter kit or template. This is a shorthand for `pnpm dlx create-<template>`.",
    inputSchema: {
      ...baseInputSchema,
      template: z.string().describe("The starter kit name, e.g., 'vite', 'react-app'."),
    },
    outputSchema: baseOutputSchema,
    annotations: {
      title: "Create a New Project",
      readOnlyHint: false, // Creates a new project directory and files.
      openWorldHint: true, // Fetches templates from the internet.
    },
  },
  async ({cwd, template, extraArgs}) => {
    const args = ["create", template];
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args.join(" "), cwd);
    return {content: [{type: "text", text: output}]};
  },
);

registeredTools.licenses = server.registerTool(
  "licenses",
  {
    description: "Checks and lists the licenses of installed packages. It can output in a human-readable or JSON format.",
    inputSchema: {
      ...baseInputSchema,
      json: z.boolean().optional().describe("If true, output the license information as a JSON object."),
      dev: z.boolean().optional().describe("If true, only check for development dependencies."),
      production: z.boolean().optional().describe("If true, only check for production dependencies."),
    },
    outputSchema: baseOutputSchema,
    annotations: {
      title: "List Package Licenses",
      readOnlyHint: true, // This command only reads information.
    },
  },
  async ({cwd, json, dev, production, extraArgs}) => {
    const args = ["licenses", "list"];
    if (json) args.push("--json");
    if (dev) args.push("--dev");
    if (production) args.push("--prod");
    if (extraArgs) args.push(...extraArgs);
    const output = await pnpmApi.executePnpmCommand(args.join(" "), cwd);
    return {content: [{type: "text", text: output}]};
  },
);

// 3. 将所有导出的 API 聚合到一个对象中
export const pnpmApi = {
  server,
  executePnpmCommand,
  tools: registeredTools,
};

// 4. 定义主函数来连接 transport 并启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP pnpm tool server running on stdio. Ready for commands.");
}

// 5. 仅在作为主模块运行时启动服务器
if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("Fatal error in MCP pnpm tool server:", error);
    process.exit(1);
  });
}
