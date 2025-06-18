import {safeRegisterTool} from "@jixo/mcp-core";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import pkg from "../package.json" with {type: "json"};
import {GitCommandError, InvalidRepoError} from "./error.js";
import {formatStatus, getSemanticFiles} from "./format.js";
import {GitWrapper} from "./git-wrapper.js";
import {
  DiffOutputSchema,
  GitAddArgsSchema,
  GitCheckoutArgsSchema,
  GitCommitArgsSchema,
  GitCommitOutputSchema,
  GitCreateBranchArgsSchema,
  GitDiffArgsSchema,
  GitDiffStagedArgsSchema,
  GitDiffUnstagedArgsSchema,
  GitInitArgsSchema,
  GitLogArgsSchema,
  GitLogOutputSchema,
  GitResetArgsSchema,
  GitShowArgsSchema,
  GitStatusArgsSchema,
  GitStatusOutputSchema,
  SuccessOutputSchema,
} from "./schema.js";

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
    description: "Shows the working tree status, providing both structured data and a human-readable summary.",
    inputSchema: GitStatusArgsSchema,
    outputSchema: GitStatusOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const status = await git.status();
        const humanReadableStatus = formatStatus(status);
        const semanticFiles = getSemanticFiles(status.files);

        return {
          structuredContent: {
            success: true,
            current: status.current,
            tracking: status.tracking,
            ahead: status.ahead,
            behind: status.behind,
            files: semanticFiles,
            isClean: status.isClean(),
          },
          content: [{type: "text", text: humanReadableStatus}],
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
    description: "Shows changes in the working directory that are not yet staged, including untracked files.",
    inputSchema: GitDiffUnstagedArgsSchema,
    outputSchema: DiffOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const trackedDiff = await git.diffUnstaged();
        const untrackedFiles = await git.getUntrackedFiles();

        const untrackedDiffs = await Promise.all(
          untrackedFiles.map(async (file) => {
            const filePath = path.join(repoPath, file);
            const content = await fs.promises.readFile(filePath, "utf-8");
            const lines = content.split("\n").map((line) => `+${line}`);
            // Simulating a git diff for a new file
            return `diff --git a/${file} b/${file}\nnew file mode 100644\nindex 0000000..${"e69de29" /* empty blob hash */}\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.join("\n")}`;
          }),
        );

        const fullDiff = [trackedDiff, ...untrackedDiffs].filter(Boolean).join("\n").trim();

        return {
          structuredContent: {success: true, diff: fullDiff},
          content: [{type: "text", text: fullDiff || "No unstaged changes."}],
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
    outputSchema: DiffOutputSchema,
  },
  async ({repoPath}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.diffStaged()).trim();
        return {
          structuredContent: {success: true, diff},
          content: [{type: "text", text: diff || "No staged changes."}],
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
    outputSchema: DiffOutputSchema,
  },
  async ({repoPath, target}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.diff(target)).trim();
        return {
          structuredContent: {success: true, diff},
          content: [{type: "text", text: diff || `No differences found with '${target}'.`}],
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
    outputSchema: GitCommitOutputSchema,
  },
  async ({repoPath, message}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const commitResult = await git.commit(message);
        const successMessage = `Changes committed successfully with hash ${commitResult.commit}`;
        return {
          structuredContent: {success: true, message: successMessage, commitHash: commitResult.commit},
          content: [{type: "text", text: successMessage}],
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
    description: "Shows the commit logs as a structured list.",
    inputSchema: GitLogArgsSchema,
    outputSchema: GitLogOutputSchema,
  },
  async ({repoPath, maxCount}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const commits = await git.log(maxCount);
        const humanReadableLog =
          "Commit history:\n" +
          commits
            .map((commit) => `Commit: ${commit.hash}\n` + `Author: ${commit.author_name} <${commit.author_email}>\n` + `Date: ${commit.date}\n` + `Message: ${commit.message}\n`)
            .join("\n");
        return {
          structuredContent: {success: true, commits: commits},
          content: [{type: "text", text: humanReadableLog}],
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
    outputSchema: DiffOutputSchema,
  },
  async ({repoPath, revision}) => {
    try {
      return await withGit(repoPath, async (git) => {
        const diff = (await git.show(revision)).trim();
        return {
          structuredContent: {success: true, diff},
          content: [{type: "text", text: diff}],
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
