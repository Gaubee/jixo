import {McpServer, type RegisteredTool} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {z} from "zod";
import pkg from "../package.json" with {type: "json"};

// --- 自定义错误类 (保持不变) ---
class PnpmExecutionError extends Error {
  constructor(
    message: string,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly exitCode: number | null,
  ) {
    super(message);
    this.name = "PnpmExecutionError";
  }
}

// --- 核心安全执行函数 (保持不变) ---
async function executePnpmCommand(args: string[], cwd?: string): Promise<string> {
  const displayCwd = cwd || process.cwd();
  console.error(`[SPAWN CWD: ${displayCwd}] pnpm ${args.join(" ")}`);

  return new Promise((resolve, reject) => {
    const pnpm = spawn("pnpm", args, {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    pnpm.stdout.on("data", (data) => (stdout += data.toString()));
    pnpm.stderr.on("data", (data) => (stderr += data.toString()));

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
        const errorMessage = `Command "pnpm ${args.join(" ")}" failed with exit code ${code}.`;
        console.error(`[ERROR] ${errorMessage}\n--- STDERR ---\n${stderr}\n--- STDOUT ---\n${stdout}`);
        reject(new PnpmExecutionError(errorMessage, stdout, stderr, code));
      }
    });
  });
}

// --- Schema 和工具定义 ---

const baseInputSchema = {
  cwd: z.string().optional().describe("The working directory to run the command in. If not provided, it runs in the current directory."),
  extraArgs: z.array(z.string()).optional().describe("An array of extra command-line arguments to pass to pnpm. Example: ['--reporter=json']."),
};

// --- 修正点 1: 定义一个严格符合 MCP 规范的输出 Schema ---
// 这个 Schema 直接对应 MCP 规范中的 `CallToolResult`。
// 它不再有复杂的 `union` 或自定义的 `error` 类型。
const outputSchema = {
  // `content` 数组现在是必需的，并且只包含标准的 `text` 类型。
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  ),
  // `isError` 是一个可选的布尔值，用于明确表示工具执行是否出错。
  // 这正是我们之前缺少的关键标志。
  isError: z.boolean().optional().describe("If true, the tool execution resulted in an error. The 'content' will contain error details."),
};

const server = new McpServer({
  name: "pnpm-tool-pro",
  version: pkg.version,
});

const registeredTools: {[key: string]: RegisteredTool} = {};

// --- 修正点 2: 更新所有工具处理器以返回符合规范的错误对象 ---
// 每个 catch 块现在都会返回一个包含 `isError: true` 和详细错误文本的 `content` 的对象。

registeredTools.install = server.registerTool(
  "install",
  {
    description: "Installs all dependencies for a project.",
    inputSchema: {...baseInputSchema, frozenLockfile: z.boolean().optional(), production: z.boolean().optional()},
    outputSchema, // 使用新的、符合规范的 Schema
    annotations: {title: "Install Project Dependencies"},
  },
  async ({cwd, frozenLockfile, production, extraArgs}) => {
    try {
      const args = ["install"];
      if (frozenLockfile) args.push("--frozen-lockfile");
      if (production) args.push("--prod");
      if (extraArgs) args.push(...extraArgs);
      const output = await pnpmApi.executePnpmCommand(args, cwd);
      return {content: [{type: "text", text: output}]};
    } catch (error) {
      if (error instanceof PnpmExecutionError) {
        // 这是正确的错误返回格式
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool 'install' failed with exit code ${error.exitCode}.\n\n--- ERROR MESSAGE ---\n${error.message}\n\n--- STDERR ---\n${error.stderr}\n\n--- STDOUT ---\n${error.stdout}`,
            },
          ],
        };
      }
      throw error;
    }
  },
);

registeredTools.add = server.registerTool(
  "add",
  {
    description: "Adds packages to project dependencies.",
    inputSchema: {...baseInputSchema, packages: z.array(z.string()).min(1), dev: z.boolean().optional(), optional: z.boolean().optional(), filter: z.string().optional()},
    outputSchema,
    annotations: {title: "Add Packages"},
  },
  async ({cwd, packages, dev, optional, filter, extraArgs}) => {
    try {
      const args = [];
      if (filter) args.push("--filter", filter);
      args.push("add");
      if (dev) args.push("-D");
      if (optional) args.push("-O");
      args.push(...packages);
      if (extraArgs) args.push(...extraArgs);
      const output = await pnpmApi.executePnpmCommand(args, cwd);
      return {content: [{type: "text", text: output}]};
    } catch (error) {
      if (error instanceof PnpmExecutionError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool 'add' failed with exit code ${error.exitCode}.\n\n--- ERROR MESSAGE ---\n${error.message}\n\n--- STDERR ---\n${error.stderr}\n\n--- STDOUT ---\n${error.stdout}`,
            },
          ],
        };
      }
      throw error;
    }
  },
);

registeredTools.run = server.registerTool(
  "run",
  {
    description: "Executes a script defined in the project's `package.json`.",
    inputSchema: {...baseInputSchema, script: z.string(), scriptArgs: z.array(z.string()).optional(), filter: z.string().optional()},
    outputSchema,
    annotations: {title: "Run a Project Script", destructiveHint: true},
  },
  async ({cwd, script, scriptArgs, filter, extraArgs}) => {
    try {
      const pkgPath = path.join(cwd || process.cwd(), "package.json");
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
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
    } catch (error) {
      if (error instanceof PnpmExecutionError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool 'run' failed with exit code ${error.exitCode}.\n\n--- ERROR MESSAGE ---\n${error.message}\n\n--- STDERR ---\n${error.stderr}\n\n--- STDOUT ---\n${error.stdout}`,
            },
          ],
        };
      }
      throw error;
    }
  },
);

registeredTools.dlx = server.registerTool(
  "dlx",
  {
    description: "Fetches and runs a package from the registry.",
    inputSchema: {...baseInputSchema, commandAndArgs: z.array(z.string()).min(1)},
    outputSchema,
    annotations: {title: "Download and Execute Package", openWorldHint: true},
  },
  async ({cwd, commandAndArgs, extraArgs}) => {
    try {
      const args = ["dlx"];
      if (extraArgs) args.push(...extraArgs);
      args.push(...commandAndArgs);
      const output = await pnpmApi.executePnpmCommand(args, cwd);
      return {content: [{type: "text", text: output}]};
    } catch (error) {
      if (error instanceof PnpmExecutionError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool 'dlx' failed with exit code ${error.exitCode}.\n\n--- ERROR MESSAGE ---\n${error.message}\n\n--- STDERR ---\n${error.stderr}\n\n--- STDOUT ---\n${error.stdout}`,
            },
          ],
        };
      }
      throw error;
    }
  },
);

registeredTools.create = server.registerTool(
  "create",
  {
    description: "Creates a new project from a starter kit.",
    inputSchema: {...baseInputSchema, template: z.string(), templateArgs: z.array(z.string()).optional()},
    outputSchema,
    annotations: {title: "Create a New Project", openWorldHint: true},
  },
  async ({cwd, template, templateArgs, extraArgs}) => {
    try {
      const args = ["create", template];
      if (templateArgs) args.push(...templateArgs);
      if (extraArgs) args.push(...extraArgs);
      const output = await pnpmApi.executePnpmCommand(args, cwd);
      return {content: [{type: "text", text: output}]};
    } catch (error) {
      if (error instanceof PnpmExecutionError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              // 把所有有用的信息都打包到这个文本里，AI 就能看到了！
              text: `Tool 'create' failed with exit code ${error.exitCode}.\n\n--- ERROR MESSAGE ---\n${error.message}\n\n--- STDERR ---\n${error.stderr}\n\n--- STDOUT ---\n${error.stdout}`,
            },
          ],
        };
      }
      throw error;
    }
  },
);

registeredTools.licenses = server.registerTool(
  "licenses",
  {
    description: "Checks and lists the licenses of installed packages.",
    inputSchema: {...baseInputSchema, json: z.boolean().optional(), dev: z.boolean().optional(), production: z.boolean().optional()},
    outputSchema,
    annotations: {title: "List Package Licenses", readOnlyHint: true},
  },
  async ({cwd, json, dev, production, extraArgs}) => {
    try {
      const args = ["licenses", "list"];
      if (json) args.push("--json");
      if (dev) args.push("--dev");
      if (production) args.push("--prod");
      if (extraArgs) args.push(...extraArgs);
      const output = await pnpmApi.executePnpmCommand(args, cwd);
      return {content: [{type: "text", text: output}]};
    } catch (error) {
      if (error instanceof PnpmExecutionError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool 'licenses' failed with exit code ${error.exitCode}.\n\n--- ERROR MESSAGE ---\n${error.message}\n\n--- STDERR ---\n${error.stderr}\n\n--- STDOUT ---\n${error.stdout}`,
            },
          ],
        };
      }
      throw error;
    }
  },
);

export const pnpmApi = {
  server,
  tools: registeredTools,
  executePnpmCommand,
};

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP pnpm tool server running on stdio. Ready for commands.");
}

if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("Fatal error in MCP pnpm tool server:", error);
    process.exit(1);
  });
}
