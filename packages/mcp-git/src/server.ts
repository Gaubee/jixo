import {safeRegisterTool} from "@jixo/mcp-core";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import {z} from "zod";
import pkg from "../package.json" with {type: "json"};
import {GitCommandError, InvalidRepoError} from "./error.js";
import {GitWrapper} from "./git-wrapper.js";

// --- Schema Definitions ---

const GenericErrorSchema = {
  error: z
    .object({
      name: z.string().describe("The type of error, e.g., 'InvalidRepoError'."),
      message: z.string().describe("A detailed description of what went wrong."),
    })
    .optional()
    .describe("Included only when 'success' is false."),
};

const SuccessOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  message: z.string().optional(),
  ...GenericErrorSchema,
};

const TextOutputSchema = {
  success: z.boolean().describe("Indicates if the operation was successful."),
  output: z.string().optional(),
  ...GenericErrorSchema,
};

// --- Tool Schemas ---
const RepoPathArgSchema = {
  repoPath: z.string().describe("Path to the Git repository."),
};
const GitStatusArgsSchema = RepoPathArgSchema;
const GitDiffUnstagedArgsSchema = RepoPathArgSchema;
const GitDiffStagedArgsSchema = RepoPathArgSchema;
const GitDiffArgsSchema = {
  ...RepoPathArgSchema,
  target: z.string().describe("Target branch or commit to compare with."),
};
const GitCommitArgsSchema = {
  ...RepoPathArgSchema,
  message: z.string().describe("Commit message."),
};
const GitAddArgsSchema = {
  ...RepoPathArgSchema,
  files: z.array(z.string()).min(1).describe("Array of file paths to stage."),
};
const GitResetArgsSchema = RepoPathArgSchema;
const GitLogArgsSchema = {
  ...RepoPathArgSchema,
  maxCount: z.number().int().min(1).optional().default(10).describe("Maximum number of commits to show."),
};
const GitCreateBranchArgsSchema = {
  ...RepoPathArgSchema,
  branchName: z.string().describe("Name of the new branch."),
  baseBranch: z.string().optional().describe("Starting point for the new branch (branch name or commit hash)."),
};
const GitCheckoutArgsSchema = {
  ...RepoPathArgSchema,
  branchName: z.string().describe("Name of the branch to checkout."),
};
const GitShowArgsSchema = {
  ...RepoPathArgSchema,
  revision: z.string().describe("The revision (commit hash, branch name, tag) to show."),
};
const GitInitArgsSchema = {
  repoPath: z.string().describe("Path to the directory to initialize the git repo in."),
};

// --- Server and Tool Registration ---

export const server = new McpServer({
  name: "mcp-git-server",
  version: pkg.version,
});

const handleToolError = (toolName: string, error: unknown) => {
  let errorMessage: string;

  if (error instanceof InvalidRepoError) {
    errorMessage = `${error.message}\n\nSuggestion: Ensure the provided 'repoPath' points to a valid Git repository, or use the 'git_init' tool to create one.`;
  } else if (error instanceof GitCommandError) {
    errorMessage = `${error.message}\n\nSuggestion: Check the command arguments and the state of your repository.`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = String(error);
  }

  console.error(`[ERROR in ${toolName}] ${errorMessage}`);

  const errorObj = error instanceof Error ? error : new Error(String(error), {cause: error});
  if (!errorObj.name || errorObj.name === "Error") {
    errorObj.name = error?.constructor?.name ?? "UnknownError";
  }

  return {
    isError: true,
    structuredContent: {
      success: false,
      error: {
        name: errorObj.name,
        message: errorMessage,
      },
    },
    content: [{type: "text" as const, text: `Error in tool '${toolName}': ${errorMessage}`}],
  };
};

async function withGit(repoPath: string, callback: (git: GitWrapper) => Promise<{structuredContent: any; content: any[]}>) {
  const git = new GitWrapper(repoPath);
  await git.validateRepo();
  return callback(git);
}

const git_init_tool = safeRegisterTool(
  server,
  "git_init",
  {
    description: "Initializes a new Git repository.",
    inputSchema: GitInitArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({repoPath}) => {
    try {
      const message = await GitWrapper.init(repoPath);
      return {
        structuredContent: {success: true, message},
        content: [{type: "text", text: message}],
      };
    } catch (error) {
      return handleToolError("git_init", error);
    }
  },
);

const git_status_tool = safeRegisterTool(
  server,
  "git_status",
  {
    description: "Shows the working tree status.",
    inputSchema: GitStatusArgsSchema,
    outputSchema: TextOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const output = await git.status();
        return {
          structuredContent: {success: true, output},
          content: [{type: "text", text: `Repository status:\n${output}`}],
        };
      });
    } catch (error) {
      return handleToolError("git_status", error);
    }
  },
);

const git_diff_unstaged_tool = safeRegisterTool(
  server,
  "git_diff_unstaged",
  {
    description: "Shows changes in the working directory that are not yet staged.",
    inputSchema: GitDiffUnstagedArgsSchema,
    outputSchema: TextOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const output = await git.diffUnstaged();
        return {
          structuredContent: {success: true, output},
          content: [{type: "text", text: output || "No unstaged changes."}],
        };
      });
    } catch (error) {
      return handleToolError("git_diff_unstaged", error);
    }
  },
);

const git_diff_staged_tool = safeRegisterTool(
  server,
  "git_diff_staged",
  {
    description: "Shows changes that are staged for commit.",
    inputSchema: GitDiffStagedArgsSchema,
    outputSchema: TextOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const output = await git.diffStaged();
        return {
          structuredContent: {success: true, output},
          content: [{type: "text", text: output || "No staged changes."}],
        };
      });
    } catch (error) {
      return handleToolError("git_diff_staged", error);
    }
  },
);

const git_diff_tool = safeRegisterTool(
  server,
  "git_diff",
  {
    description: "Shows differences between the current state and a branch or commit.",
    inputSchema: GitDiffArgsSchema,
    outputSchema: TextOutputSchema,
  },
  async ({repoPath, target}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const output = await git.diff(target);
        return {
          structuredContent: {success: true, output},
          content: [{type: "text", text: output || `No differences found with '${target}'.`}],
        };
      });
    } catch (error) {
      return handleToolError("git_diff", error);
    }
  },
);

const git_commit_tool = safeRegisterTool(
  server,
  "git_commit",
  {
    description: "Records changes to the repository.",
    inputSchema: GitCommitArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({repoPath, message}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const output = await git.commit(message);
        return {
          structuredContent: {success: true, message: output},
          content: [{type: "text", text: output}],
        };
      });
    } catch (error) {
      return handleToolError("git_commit", error);
    }
  },
);

const git_add_tool = safeRegisterTool(
  server,
  "git_add",
  {
    description: "Adds file contents to the staging area.",
    inputSchema: GitAddArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({repoPath, files}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.add(files);
        return {
          structuredContent: {success: true, message},
          content: [{type: "text", text: message}],
        };
      });
    } catch (error) {
      return handleToolError("git_add", error);
    }
  },
);

const git_reset_tool = safeRegisterTool(
  server,
  "git_reset",
  {
    description: "Unstages all staged changes.",
    inputSchema: GitResetArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.reset();
        return {
          structuredContent: {success: true, message},
          content: [{type: "text", text: message}],
        };
      });
    } catch (error) {
      return handleToolError("git_reset", error);
    }
  },
);

const git_log_tool = safeRegisterTool(
  server,
  "git_log",
  {
    description: "Shows the commit logs.",
    inputSchema: GitLogArgsSchema,
    outputSchema: TextOutputSchema,
  },
  async ({repoPath, maxCount}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const output = await git.log(maxCount);
        return {
          structuredContent: {success: true, output},
          content: [{type: "text", text: `Commit history:\n${output}`}],
        };
      });
    } catch (error) {
      return handleToolError("git_log", error);
    }
  },
);

const git_create_branch_tool = safeRegisterTool(
  server,
  "git_create_branch",
  {
    description: "Creates a new branch from an optional base branch.",
    inputSchema: GitCreateBranchArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({repoPath, branchName, baseBranch}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.createBranch(branchName, baseBranch);
        return {
          structuredContent: {success: true, message},
          content: [{type: "text", text: message}],
        };
      });
    } catch (error) {
      return handleToolError("git_create_branch", error);
    }
  },
);

const git_checkout_tool = safeRegisterTool(
  server,
  "git_checkout",
  {
    description: "Switches branches.",
    inputSchema: GitCheckoutArgsSchema,
    outputSchema: SuccessOutputSchema,
  },
  async ({repoPath, branchName}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const message = await git.checkout(branchName);
        return {
          structuredContent: {success: true, message},
          content: [{type: "text", text: message}],
        };
      });
    } catch (error) {
      return handleToolError("git_checkout", error);
    }
  },
);

const git_show_tool = safeRegisterTool(
  server,
  "git_show",
  {
    description: "Shows the contents and metadata of a commit.",
    inputSchema: GitShowArgsSchema,
    outputSchema: TextOutputSchema,
  },
  async ({repoPath, revision}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const output = await git.show(revision);
        return {
          structuredContent: {success: true, output},
          content: [{type: "text", text: output}],
        };
      });
    } catch (error) {
      return handleToolError("git_show", error);
    }
  },
);

export const tools = {
  git_init: git_init_tool,
  git_status: git_status_tool,
  git_diff_unstaged: git_diff_unstaged_tool,
  git_diff_staged: git_diff_staged_tool,
  git_diff: git_diff_tool,
  git_commit: git_commit_tool,
  git_add: git_add_tool,
  git_reset: git_reset_tool,
  git_log: git_log_tool,
  git_create_branch: git_create_branch_tool,
  git_checkout: git_checkout_tool,
  git_show: git_show_tool,
};

export async function startServer(repositoryPath?: string) {
  // In a real server, we would handle multiple repositories,
  // potentially discovered via client capabilities, similar to the Python version.
  // For this direct translation, we'll focus on the single repository case.
  if (repositoryPath) {
    const absolutePath = path.resolve(repositoryPath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`Error: Repository path does not exist: ${absolutePath}`);
      process.exit(1);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("MCP Git Server running on stdio.");
  if (repositoryPath) {
    console.error(`Default repository: ${path.resolve(repositoryPath)}`);
  } else {
    console.error("No default repository specified. 'repoPath' must be provided in each tool call.");
  }
}
