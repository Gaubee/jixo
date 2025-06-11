import {McpServer, type RegisteredTool} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

// --- 自定义错误类 (保持不变) ---
// 这个类依然很有用，用于在代码内部传递结构化的 pnpm 错误。
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
    // ... (spawn logic remains identical)
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
        // Rejecting our custom error instance is still the correct internal mechanism.
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

// --- 修正点 1: 定义一个类型安全的、更丰富的输出 Schema ---
// 我们不再尝试向 `content` 中添加自定义类型。
// 而是利用 `structuredContent` 字段来携带机器可读的错误信息。

// 这是错误信息的结构化 schema
const errorStructureSchema = z.object({
  commandFailed: z.literal(true).describe("A flag indicating that the pnpm command did not exit successfully."),
  exitCode: z.number().nullable().describe("The exit code of the failed command."),
  stdout: z.string().describe("The standard output from the failed command."),
  stderr: z.string().describe("The standard error output from the failed command, often containing the most useful error details."),
});

// 这是所有工具共用的输出 schema
const baseOutputSchema = {
  // `content` 只包含标准的 'text' 类型。失败时，它将容纳一个人类可读的错误摘要。
  content: z
    .array(
      z.object({
        type: z.literal("text"),
        text: z.string(),
      }),
    )
    .describe("The result of the tool call, containing the command's standard output on success, or a formatted error message on failure."),
  // `structuredContent` 是可选的，并且只在命令执行失败时填充。
  structuredContent: errorStructureSchema
    .optional()
    .describe("On command failure, this object contains machine-readable details about the error, such as stdout, stderr, and the exit code."),
};

const server = new McpServer({
  name: "pnpm-tool-pro",
  version: "2.5.0", // 版本升级，体现类型安全和鲁棒性
});

const registeredTools: {[key: string]: RegisteredTool} = {};

// --- 修正点 2: 更新所有工具处理器以符合新的 Schema ---
// 每个 catch 块现在都会返回一个合法的 ToolOutput 对象，
// 其中 `content` 包含文本错误，`structuredContent` 包含详细信息。

registeredTools.install = server.registerTool(
  "pnpm_install",
  {
    description: "Installs all dependencies for a project.",
    inputSchema: {...baseInputSchema, frozenLockfile: z.boolean().optional(), production: z.boolean().optional()},
    outputSchema: baseOutputSchema,
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
        // 返回结构化的错误信息
        return {
          content: [{type: "text", text: `Error during 'pnpm install':\n${error.message}\n\n--- STDERR ---\n${error.stderr}`}],
          structuredContent: {commandFailed: true, stdout: error.stdout, stderr: error.stderr, exitCode: error.exitCode},
        };
      }
      throw error; // 重新抛出非预期的错误
    }
  },
);

// 为简洁起见，我将为剩余的工具应用相同的模式。
// 每个工具的 try/catch 逻辑都是相似的。

registeredTools.add = server.registerTool(
  "pnpm_add",
  {
    description: "Adds packages to project dependencies.",
    inputSchema: {...baseInputSchema, packages: z.array(z.string()).min(1), dev: z.boolean().optional(), optional: z.boolean().optional(), filter: z.string().optional()},
    outputSchema: baseOutputSchema,
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
          content: [{type: "text", text: `Error during 'pnpm add':\n${error.message}\n\n--- STDERR ---\n${error.stderr}`}],
          structuredContent: {commandFailed: true, stdout: error.stdout, stderr: error.stderr, exitCode: error.exitCode},
        };
      }
      throw error;
    }
  },
);

registeredTools.run = server.registerTool(
  "pnpm_run",
  {
    description: "Executes a script defined in the project's `package.json`.",
    inputSchema: {...baseInputSchema, script: z.string(), scriptArgs: z.array(z.string()).optional(), filter: z.string().optional()},
    outputSchema: baseOutputSchema,
    annotations: {title: "Run a Project Script", destructiveHint: true},
  },
  async ({cwd, script, scriptArgs, filter, extraArgs}) => {
    try {
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
    } catch (error) {
      if (error instanceof PnpmExecutionError) {
        return {
          content: [{type: "text", text: `Error during 'pnpm run ${script}':\n${error.message}\n\n--- STDERR ---\n${error.stderr}`}],
          structuredContent: {commandFailed: true, stdout: error.stdout, stderr: error.stderr, exitCode: error.exitCode},
        };
      }
      throw error;
    }
  },
);

registeredTools.dlx = server.registerTool(
  "pnpm_dlx",
  {
    description: "Fetches and runs a package from the registry.",
    inputSchema: {...baseInputSchema, commandAndArgs: z.array(z.string()).min(1)},
    outputSchema: baseOutputSchema,
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
          content: [{type: "text", text: `Error during 'pnpm dlx':\n${error.message}\n\n--- STDERR ---\n${error.stderr}`}],
          structuredContent: {commandFailed: true, stdout: error.stdout, stderr: error.stderr, exitCode: error.exitCode},
        };
      }
      throw error;
    }
  },
);

registeredTools.create = server.registerTool(
  "pnpm_create",
  {
    description: "Creates a new project from a starter kit.",
    inputSchema: {...baseInputSchema, template: z.string(), templateArgs: z.array(z.string()).optional()},
    outputSchema: baseOutputSchema,
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
          content: [{type: "text", text: `Error during 'pnpm create ${template}':\n${error.message}\n\n--- STDERR ---\n${error.stderr}`}],
          structuredContent: {commandFailed: true, stdout: error.stdout, stderr: error.stderr, exitCode: error.exitCode},
        };
      }
      throw error;
    }
  },
);

registeredTools.licenses = server.registerTool(
  "pnpm_licenses",
  {
    description: "Checks and lists the licenses of installed packages.",
    inputSchema: {...baseInputSchema, json: z.boolean().optional(), dev: z.boolean().optional(), production: z.boolean().optional()},
    outputSchema: baseOutputSchema,
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
          content: [{type: "text", text: `Error during 'pnpm licenses':\n${error.message}\n\n--- STDERR ---\n${error.stderr}`}],
          structuredContent: {commandFailed: true, stdout: error.stdout, stderr: error.stderr, exitCode: error.exitCode},
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

// ... (main function remains the same)
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
