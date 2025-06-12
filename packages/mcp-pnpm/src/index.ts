#!/usr/bin/env node

import {McpServer, type RegisteredTool, type ToolCallback} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {z, type ZodObject, type ZodRawShape} from "zod";
import pkg from "../package.json" with {type: "json"};

// --- Custom Error Class ---
/**
 * Thrown when a pnpm command fails to execute successfully.
 * Contains stdout, stderr, and the exit code for detailed diagnostics.
 */
export class PnpmExecutionError extends Error {
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

// --- Core API and Helper Functions ---
const helpers = {
  /**
   * Securely executes a pnpm command in a subprocess.
   * @param args - An array of arguments to pass to the pnpm command.
   * @param cwd - The working directory for the command.
   * @returns A promise that resolves with the command's stdout.
   * @throws {PnpmExecutionError} if the command fails.
   */
  executePnpmCommand: async (args: string[], cwd?: string): Promise<{stdout: string; stderr: string; exitCode: number | null}> => {
    const displayCwd = cwd || process.cwd();
    console.error(`[SPAWN CWD: ${displayCwd}] pnpm ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
      const pnpm = spawn("pnpm", args, {
        cwd,
        shell: true, // Use shell for better cross-platform compatibility with PATH resolution
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
          // Log stderr as a warning if the command still succeeded
          console.error(`[STDWARN] ${stderr}`);
        }

        if (code === 0) {
          resolve({stdout, stderr, exitCode: code});
        } else {
          const errorMessage = `Command "pnpm ${args.join(" ")}" failed with exit code ${code}.`;
          console.error(`[ERROR] ${errorMessage}\n--- STDERR ---\n${stderr}\n--- STDOUT ---\n${stdout}`);
          reject(new PnpmExecutionError(errorMessage, stdout, stderr, code));
        }
      });
    });
  },
};

// --- Schema Definitions ---

// --- Base Schemas ---
const baseInputSchema = {
  cwd: z.string().optional().describe("The working directory to run the command in. Defaults to the current directory."),
  extraArgs: z.array(z.string()).optional().describe("An array of extra, less-common command-line arguments to pass to pnpm. Example: ['--reporter=json']."),
};

const GenericErrorSchema = {
  error: z
    .object({
      name: z.string().describe("The type of error, e.g., 'PnpmExecutionError'."),
      message: z.string().describe("A detailed description of what went wrong."),
    })
    .optional()
    .describe("Included only when 'success' is false."),
};

const BasePnpmOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  stdout: z.string().optional().describe("The standard output from the pnpm command."),
  stderr: z.string().optional().describe("The standard error from the pnpm command. May contain warnings even on success."),
  exitCode: z.number().nullable().optional().describe("The exit code of the pnpm command."),
  ...GenericErrorSchema,
};

// --- Tool-Specific Output Schemas ---
const JsonOutputSchema = {
  jsonData: z.record(z.string(), z.any()).or(z.array(z.any())).optional().describe("The parsed JSON output from the command, if --json is used."),
};

const LicensesOutputSchema = {
  ...BasePnpmOutputSchema,
  entries: z.array(z.any()).optional().describe("A structured list of licenses, only available when using the '--json' flag."),
};

const InfoOutputSchema = {
  ...BasePnpmOutputSchema,
  ...JsonOutputSchema,
};

const ListOutputSchema = {
  ...BasePnpmOutputSchema,
  ...JsonOutputSchema,
};

const OutdatedOutputSchema = {
  ...BasePnpmOutputSchema,
  ...JsonOutputSchema,
};

// --- Server and Tool Registration ---

const server = new McpServer({
  name: "pnpm-server",
  version: pkg.version,
});

/**
 * A type-safe wrapper for `server.registerTool`.
 */
function safeRegisterTool<I extends ZodRawShape, O extends ZodRawShape>(
  name: string,
  config: {
    description?: string;
    inputSchema?: I;
    outputSchema?: O;
    annotations?: RegisteredTool["annotations"];
  },
  callback: ToolCallback<I>,
): {
  underlying: RegisteredTool;
  inputSchema: ZodObject<I>;
  outputSchema: ZodObject<O>;
  callback: ToolCallback<I>;
} {
  const underlying = server.registerTool(name, config, callback);
  return {
    underlying,
    inputSchema: z.object(config.inputSchema ?? ({} as I)),
    outputSchema: z.object(config.outputSchema ?? ({} as O)),
    callback,
  };
}

/**
 * Centralized error handler for all pnpm tools.
 */
const handleToolError = (toolName: string, error: unknown) => {
  let userMessage: string;
  const structuredError: z.TypeOf<z.ZodObject<typeof BasePnpmOutputSchema>> = {
    success: false,
  };

  if (error instanceof PnpmExecutionError) {
    userMessage = `Tool '${toolName}' failed with exit code ${error.exitCode}.\n\n--- ERROR MESSAGE ---\n${error.message}\n\n--- STDERR ---\n${error.stderr}\n\n--- STDOUT ---\n${error.stdout}`;
    structuredError.error = {name: error.name, message: error.message};
    structuredError.stdout = error.stdout;
    structuredError.stderr = error.stderr;
    structuredError.exitCode = error.exitCode;
  } else if (error instanceof Error) {
    userMessage = `An unexpected error occurred in '${toolName}': ${error.message}`;
    structuredError.error = {name: error.name, message: error.message};
  } else {
    userMessage = `An unknown error occurred in '${toolName}': ${String(error)}`;
    structuredError.error = {name: "UnknownError", message: String(error)};
  }

  return {
    isError: true,
    structuredContent: structuredError,
    content: [{type: "text" as const, text: userMessage}],
  };
};

// --- Tool Implementations ---

const install_tool = safeRegisterTool(
  "install",
  {
    description: "Installs all dependencies for a project.",
    inputSchema: {
      ...baseInputSchema,
      frozenLockfile: z.boolean().optional().describe("Disallow changes to the lockfile. Fails if the lockfile is out of sync."),
      production: z.boolean().optional().describe("Only install 'dependencies', skipping 'devDependencies'."),
      filter: z.string().optional().describe("In a monorepo, limit the command to a subset of projects. See pnpm filtering docs for syntax."),
    },
    outputSchema: BasePnpmOutputSchema,
    annotations: {title: "Install Project Dependencies"},
  },
  async ({cwd, frozenLockfile, production, filter, extraArgs}) => {
    try {
      const args = [];
      if (filter) args.push("--filter", filter);
      args.push("install");
      if (frozenLockfile) args.push("--frozen-lockfile");
      if (production) args.push("--prod");
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      return {
        structuredContent: {success: true, stdout, stderr, exitCode},
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("install", error);
    }
  },
);

const add_tool = safeRegisterTool(
  "add",
  {
    description: "Adds one or more packages to project dependencies.",
    inputSchema: {
      ...baseInputSchema,
      packages: z.array(z.string()).min(1).describe("The list of packages to add (e.g., ['zod', 'typescript@latest'])."),
      dev: z
        .boolean()
        .optional()
        .describe("Install as a 'dev' dependency. CHOICE GUIDANCE: Use for build tools, test frameworks, and linters (e.g., 'typescript', 'jest', 'eslint')."),
      optional: z.boolean().optional().describe("Install as an 'optional' dependency. CHOICE GUIDANCE: Use for non-critical dependencies."),
      filter: z.string().optional().describe("In a monorepo, limit the command to a subset of projects."),
      workspaceRoot: z.boolean().optional().describe("Add the dependency to the root workspace package.json."),
    },
    outputSchema: BasePnpmOutputSchema,
    annotations: {title: "Add Packages"},
  },
  async ({cwd, packages, dev, optional, filter, workspaceRoot, extraArgs}) => {
    try {
      const args = [];
      if (filter) args.push("--filter", filter);
      args.push("add");
      if (dev) args.push("-D");
      if (optional) args.push("-O");
      if (workspaceRoot) args.push("-w");
      args.push(...packages);
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      return {
        structuredContent: {success: true, stdout, stderr, exitCode},
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("add", error);
    }
  },
);

const remove_tool = safeRegisterTool(
  "remove",
  {
    description: "Removes packages from dependencies.",
    inputSchema: {
      ...baseInputSchema,
      packages: z.array(z.string()).min(1).describe("The list of packages to remove."),
      dev: z.boolean().optional().describe("Also remove from 'devDependencies'."),
      optional: z.boolean().optional().describe("Also remove from 'optionalDependencies'."),
      filter: z.string().optional().describe("In a monorepo, limit the command to a subset of projects."),
    },
    outputSchema: BasePnpmOutputSchema,
    annotations: {title: "Remove Packages", aliases: ["rm"]},
  },
  async ({cwd, packages, dev, optional, filter, extraArgs}) => {
    try {
      const args = [];
      if (filter) args.push("--filter", filter);
      args.push("remove");
      if (dev) args.push("-D");
      if (optional) args.push("-O");
      args.push(...packages);
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      return {
        structuredContent: {success: true, stdout, stderr, exitCode},
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("remove", error);
    }
  },
);

const run_tool = safeRegisterTool(
  "run",
  {
    description: "Executes a script defined in the project's `package.json`.",
    inputSchema: {
      ...baseInputSchema,
      script: z.string().describe("The name of the script to run."),
      scriptArgs: z.array(z.string()).optional().describe("Arguments to pass directly to the executed script."),
      filter: z.string().optional().describe("In a monorepo, limit the command to a subset of projects."),
    },
    outputSchema: BasePnpmOutputSchema,
    annotations: {title: "Run a Project Script", destructiveHint: true},
  },
  async ({cwd, script, scriptArgs, filter, extraArgs}) => {
    try {
      const pkgPath = path.join(cwd || process.cwd(), "package.json");
      try {
        const pkgData = await fs.readFile(pkgPath, "utf-8");
        const pkg = JSON.parse(pkgData);
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
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      return {
        structuredContent: {success: true, stdout, stderr, exitCode},
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("run", error);
    }
  },
);

const list_tool = safeRegisterTool(
  "list",
  {
    description: "Lists installed packages and their dependencies.",
    inputSchema: {
      ...baseInputSchema,
      depth: z.number().int().min(0).optional().describe("The maximum depth of the dependency tree to display."),
      json: z.boolean().optional().describe("Show information in JSON format. CHOICE GUIDANCE: Set to true for programmatic use."),
      production: z.boolean().optional().describe("Display only the dependency graph for packages in 'dependencies'."),
      dev: z.boolean().optional().describe("Display only the dependency graph for packages in 'devDependencies'."),
      filter: z.string().optional().describe("In a monorepo, limit the command to a subset of projects."),
    },
    outputSchema: ListOutputSchema,
    annotations: {title: "List Installed Packages", aliases: ["ls"], readOnlyHint: true},
  },
  async ({cwd, depth, json, production, dev, filter, extraArgs}) => {
    try {
      const args = [];
      if (filter) args.push("--filter", filter);
      args.push("list");
      if (depth !== undefined) args.push(`--depth=${depth}`);
      if (json) args.push("--json");
      if (production) args.push("--prod");
      if (dev) args.push("--dev");
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      const structuredContent: z.TypeOf<z.ZodObject<typeof ListOutputSchema>> = {success: true, stdout, stderr, exitCode};
      if (json && stdout) {
        try {
          structuredContent.jsonData = JSON.parse(stdout);
        } catch (parseError) {
          return handleToolError("list", new Error(`Failed to parse JSON output: ${(parseError as Error).message}`));
        }
      }
      return {
        structuredContent,
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("list", error);
    }
  },
);

const outdated_tool = safeRegisterTool(
  "outdated",
  {
    description: "Checks for outdated packages. A great precursor to using the 'update' tool.",
    inputSchema: {
      ...baseInputSchema,
      packages: z.array(z.string()).optional().describe("A list of specific packages to check."),
      json: z.boolean().optional().describe("Show information in JSON format. CHOICE GUIDANCE: Set to true for programmatic use."),
      recursive: z.boolean().optional().describe("Check for outdated dependencies in every package in a monorepo."),
    },
    outputSchema: OutdatedOutputSchema,
    annotations: {title: "Check for Outdated Packages", readOnlyHint: true},
  },
  async ({cwd, packages, json, recursive, extraArgs}) => {
    try {
      const args = ["outdated"];
      if (packages) args.push(...packages);
      if (json) args.push("--json");
      if (recursive) args.push("-r");
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      const structuredContent: z.TypeOf<z.ZodObject<typeof OutdatedOutputSchema>> = {success: true, stdout, stderr, exitCode};
      if (json && stdout) {
        try {
          structuredContent.jsonData = JSON.parse(stdout);
        } catch (parseError) {
          return handleToolError("outdated", new Error(`Failed to parse JSON output: ${(parseError as Error).message}`));
        }
      }
      return {
        structuredContent,
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("outdated", error);
    }
  },
);

const update_tool = safeRegisterTool(
  "update",
  {
    description: "Updates packages to their latest version based on the specified range in package.json.",
    inputSchema: {
      ...baseInputSchema,
      packages: z.array(z.string()).optional().describe("A list of specific packages to update. If omitted, all dependencies are updated."),
      latest: z.boolean().optional().describe("Ignore the version range specified in 'package.json' and update to the 'latest' tag."),
      recursive: z.boolean().optional().describe("Update dependencies in every package in a monorepo."),
      interactive: z
        .boolean()
        .optional()
        .describe(
          "Show outdated dependencies and select which ones to update. AI NOTE: This is NOT recommended for automated environments as it requires human interaction. Use 'outdated' first.",
        ),
    },
    outputSchema: BasePnpmOutputSchema,
    annotations: {title: "Update Packages", aliases: ["up"]},
  },
  async ({cwd, packages, latest, recursive, interactive, extraArgs}) => {
    try {
      const args = ["update"];
      if (packages) args.push(...packages);
      if (latest) args.push("--latest");
      if (recursive) args.push("-r");
      if (interactive) args.push("-i");
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      return {
        structuredContent: {success: true, stdout, stderr, exitCode},
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("update", error);
    }
  },
);

const dlx_tool = safeRegisterTool(
  "dlx",
  {
    description: "Fetches and runs a package from the registry without installing it as a dependency.",
    inputSchema: {
      ...baseInputSchema,
      commandAndArgs: z.array(z.string()).min(1).describe("The package/command to execute, followed by its arguments."),
    },
    outputSchema: BasePnpmOutputSchema,
    annotations: {title: "Download and Execute Package", openWorldHint: true},
  },
  async ({cwd, commandAndArgs, extraArgs}) => {
    try {
      const args = ["dlx"];
      if (extraArgs) args.push(...extraArgs);
      args.push(...commandAndArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      return {
        structuredContent: {success: true, stdout, stderr, exitCode},
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("dlx", error);
    }
  },
);

const create_tool = safeRegisterTool(
  "create",
  {
    description: "Creates a new project from a starter kit.",
    inputSchema: {
      ...baseInputSchema,
      template: z.string().describe("The starter kit or template to use (e.g., 'vite', 'react-app')."),
      templateArgs: z.array(z.string()).optional().describe("Arguments to pass to the create command."),
    },
    outputSchema: BasePnpmOutputSchema,
    annotations: {title: "Create a New Project", openWorldHint: true},
  },
  async ({cwd, template, templateArgs, extraArgs}) => {
    try {
      const args = ["create", template];
      if (templateArgs) args.push(...templateArgs);
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);
      return {
        structuredContent: {success: true, stdout, stderr, exitCode},
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("create", error);
    }
  },
);

const licenses_tool = safeRegisterTool(
  "licenses",
  {
    description: "Checks and lists the licenses of installed packages.",
    inputSchema: {
      ...baseInputSchema,
      json: z.boolean().optional().describe("Show information in JSON format. CHOICE GUIDANCE: Set to true for programmatic use."),
      long: z.boolean().optional().describe("Show more details, like package paths."),
      dev: z.boolean().optional().describe("Only display licenses for 'devDependencies'."),
      production: z.boolean().optional().describe("Only display licenses for 'dependencies'."),
      filter: z.string().optional().describe("In a monorepo, limit the command to a subset of projects."),
    },
    outputSchema: LicensesOutputSchema,
    annotations: {title: "List Package Licenses", readOnlyHint: true},
  },
  async ({cwd, json, long, dev, production, filter, extraArgs}) => {
    try {
      const args = [];
      if (filter) args.push("--filter", filter);
      args.push("licenses", "list");
      if (json) args.push("--json");
      if (long) args.push("--long");
      if (dev) args.push("--dev");
      if (production) args.push("--prod");
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);

      const structuredContent: z.TypeOf<z.ZodObject<typeof LicensesOutputSchema>> = {success: true, stdout, stderr, exitCode};
      if (json && stdout) {
        try {
          structuredContent.entries = JSON.parse(stdout);
        } catch (parseError) {
          // If JSON parsing fails, return it as an error but keep the original output
          return handleToolError("licenses", new Error(`Failed to parse JSON output: ${(parseError as Error).message}`));
        }
      }

      return {
        structuredContent,
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("licenses", error);
    }
  },
);

const info_tool = safeRegisterTool(
  "info",
  {
    description: "View registry information about packages.",
    inputSchema: {
      ...baseInputSchema,
      packages: z.array(z.string()).optional().describe("One or more package specifications to view (e.g., 'zod', 'typescript@latest')."),
      fields: z.array(z.string()).optional().describe("Specific fields to view (e.g., 'version', 'license')."),
      json: z.boolean().optional().describe("Show information in JSON format. CHOICE GUIDANCE: Set to true for programmatic use."),
    },
    outputSchema: InfoOutputSchema,
    annotations: {title: "View Package Info", readOnlyHint: true},
  },
  async ({cwd, packages, fields, json, extraArgs}) => {
    try {
      const args = ["info"];
      if (packages) args.push(...packages);
      if (fields) args.push(...fields);
      if (json) args.push("--json");
      if (extraArgs) args.push(...extraArgs);
      const {stdout, stderr, exitCode} = await helpers.executePnpmCommand(args, cwd);

      const structuredContent: z.TypeOf<z.ZodObject<typeof InfoOutputSchema>> = {success: true, stdout, stderr, exitCode};
      if (json && stdout) {
        try {
          structuredContent.jsonData = JSON.parse(stdout);
        } catch (parseError) {
          return handleToolError("info", new Error(`Failed to parse JSON output: ${(parseError as Error).message}`));
        }
      }

      return {
        structuredContent,
        content: [{type: "text", text: stdout || `Command "pnpm ${args.join(" ")}" executed successfully.`}],
      };
    } catch (error) {
      return handleToolError("info", error);
    }
  },
);

// --- API Export for Testing and Main Entry ---

export const pnpmApi = {
  server,
  tools: {
    install: install_tool,
    add: add_tool,
    remove: remove_tool,
    run: run_tool,
    list: list_tool,
    outdated: outdated_tool,
    update: update_tool,
    dlx: dlx_tool,
    create: create_tool,
    licenses: licenses_tool,
    info: info_tool,
  },
  helpers,
};

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP pnpm server running on stdio. Ready for commands.");
}

if (import_meta_ponyfill(import.meta).main) {
  main().catch((error) => {
    console.error("Fatal error in MCP pnpm server:", error);
    process.exit(1);
  });
}
