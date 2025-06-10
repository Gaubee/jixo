import {McpServer, type RegisteredTool} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {exec} from "node:child_process";
import fs from "node:fs/promises";
import {promisify} from "node:util";
import {z} from "zod";

const execAsync = promisify(exec);

/**
 * 安全地执行一个 pnpm 命令并返回其输出。
 * @param command - The pnpm command and arguments to execute.
 * @returns A promise that resolves with the command's stdout.
 */
async function executePnpmCommand(command: string): Promise<string> {
  try {
    // Log the command to stderr for debugging purposes.
    console.error(`[EXEC] pnpm ${command}`);
    const {stdout, stderr} = await execAsync(`pnpm ${command}`);
    if (stderr) {
      // pnpm often uses stderr for progress, warnings, etc. We'll log it.
      console.error(`[STDERR] ${stderr}`);
    }
    // Return stdout, or a success message if stdout is empty.
    return stdout || `Command "pnpm ${command}" executed successfully.`;
  } catch (error: any) {
    console.error(`[ERROR] Failed to execute "pnpm ${command}":`, error);
    // Re-throw a more informative error for the MCP client.
    throw new Error(`Failed to execute command: "pnpm ${command}".\nError: ${error.stderr || error.stdout || error.message}`);
  }
}

// 1. 创建 MCP Server 实例
const server = new McpServer({
  name: "pnpm-tool",
  version: "1.0.0",
});

const registeredTools: {[key: string]: RegisteredTool} = {};

// ✅ 将需要导出的内容组织在一个对象里
export const pnpmApi = {
  server,
  executePnpmCommand,
  tools: registeredTools,
};

// 2. 使用链式调用定义所有 pnpm 工具

/**
 * Tool: pnpm install
 * Description: Installs project dependencies from the lockfile.
 */
registeredTools.install = server.tool(
  "install",
  {}, // No input parameters
  async () => {
    const output = await pnpmApi.executePnpmCommand("install");
    return {content: [{type: "text", text: output}]};
  },
);

/**
 * Tool: pnpm add
 * Description: Adds one or more packages to dependencies.
 */
registeredTools.add = server.tool(
  "add",
  {
    packages: z.array(z.string()).min(1).describe("A list of packages to add (e.g., ['react', 'jsr:@foo/bar@^1.0.0'])"),
    dev: z.boolean().optional().describe("Install as a development dependency (-D)."),
    filter: z.string().optional().describe("Filter for a specific workspace project to add the dependency to."),
  },
  async ({packages, dev, filter}) => {
    const args = [];
    if (filter) args.push(`--filter ${filter}`);
    args.push("add");
    if (dev) args.push("-D");
    args.push(...packages);

    const output = await pnpmApi.executePnpmCommand(args.join(" "));
    return {content: [{type: "text", text: output}]};
  },
);

/**
 * Tool: pnpm run
 * Description: Runs a script defined in package.json.
 * Note: Includes a security check to only run predefined scripts.
 */
registeredTools.run = server.tool(
  "run",
  {
    script: z.string().describe("The name of the script to run from package.json."),
    args: z.array(z.string()).optional().describe("Additional arguments to pass to the script."),
    filter: z.string().optional().describe("Filter for a specific workspace project."),
  },
  async ({script, args, filter}) => {
    // --- SECURITY CHECK ---
    let pkg;
    try {
      const pkgJsonContent = await fs.readFile("package.json", "utf-8");
      pkg = JSON.parse(pkgJsonContent);
    } catch (e) {
      throw new Error("Security check failed: Could not read or parse package.json.");
    }

    if (!pkg.scripts || !pkg.scripts[script]) {
      throw new Error(`Security check failed: Script "${script}" not found in package.json's "scripts" section.`);
    }
    // --- END SECURITY CHECK ---

    const commandArgs = [];
    if (filter) commandArgs.push(`--filter ${filter}`);
    commandArgs.push(`run ${script}`);
    if (args && args.length > 0) {
      commandArgs.push("--", ...args);
    }

    const output = await pnpmApi.executePnpmCommand(commandArgs.join(" "));
    return {content: [{type: "text", text: output}]};
  },
);

/**
 * Tool: pnpm dlx
 * Description: Executes a package in a temporary environment.
 */
registeredTools.dlx = server.tool(
  "dlx",
  {
    command: z.string().describe("The package/command to execute, e.g., 'create-svelte@next' or 'cowsay'"),
    args: z.array(z.string()).optional().describe("Arguments to pass to the command."),
  },
  async ({command, args}) => {
    const fullCommand = `dlx ${command}${args ? " " + args.join(" ") : ""}`;
    const output = await pnpmApi.executePnpmCommand(fullCommand);
    return {content: [{type: "text", text: output}]};
  },
);

/**
 * Tool: pnpm create
 * Description: Creates a project from a starter kit.
 */
registeredTools.create = server.tool(
  "create",
  {
    template: z.string().describe("The starter kit or template name (e.g., 'vite')."),
    args: z.array(z.string()).optional().describe("Additional arguments for the creator."),
  },
  async ({template, args}) => {
    const fullCommand = `create ${template}${args ? " " + args.join(" ") : ""}`;
    const output = await pnpmApi.executePnpmCommand(fullCommand);
    return {content: [{type: "text", text: output}]};
  },
);

/**
 * Tool: pnpm licenses list
 * Description: Displays license information for installed packages.
 */
registeredTools.licenses = server.tool(
  "licenses",
  {
    json: z.boolean().optional().describe("Output licenses in JSON format."),
    // Note: 'pnpm licenses' does not support filtering directly.
    // This is a placeholder for future enhancement or documentation.
    workspace: z.string().optional().describe("Not yet supported. The workspace to check."),
  },
  async ({json}) => {
    const command = `licenses list${json ? " --json" : ""}`;
    const output = await pnpmApi.executePnpmCommand(command);
    return {content: [{type: "text", text: output}]};
  },
);

// 3. 定义主函数来连接 transport 并启动服务器
async function main() {
  // Use Stdio for command-line communication
  const transport = new StdioServerTransport();

  // Connect the server to the transport
  await server.connect(transport);

  console.error("MCP pnpm tool server running on stdio. Ready for commands.");
}

import {import_meta_ponyfill} from "import-meta-ponyfill";
if (import_meta_ponyfill(import.meta).main) {
  // 运行主函数并捕获任何致命错误
  main().catch((error) => {
    console.error("Fatal error in MCP pnpm tool server:", error);
    process.exit(1);
  });
}
