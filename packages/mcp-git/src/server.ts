import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import {git_add_tool} from "./tools/git_add_tool.js";
import {git_checkout_tool} from "./tools/git_checkout_tool.js";
import {git_clone_tool} from "./tools/git_clone_tool.js";
import {git_commit_tool} from "./tools/git_commit_tool.js";
import {git_create_branch_tool} from "./tools/git_create_branch_tool.js";
import {git_diff_staged_tool} from "./tools/git_diff_staged_tool.js";
import {git_diff_tool} from "./tools/git_diff_tool.js";
import {git_diff_unstaged_tool} from "./tools/git_diff_unstaged_tool.js";
import {git_init_tool} from "./tools/git_init_tool.js";
import {git_log_tool} from "./tools/git_log_tool.js";
import {git_merge_tool} from "./tools/git_merge_tool.js";
import {git_rebase_tool} from "./tools/git_rebase_tool.js";
import {git_reset_tool} from "./tools/git_reset_tool.js";
import {git_show_tool} from "./tools/git_show_tool.js";
import {git_stash_list_tool} from "./tools/git_stash_list_tool.js";
import {git_stash_pop_tool} from "./tools/git_stash_pop_tool.js";
import {git_stash_push_tool} from "./tools/git_stash_push_tool.js";
import {git_status_tool} from "./tools/git_status_tool.js";
import {git_tag_tool} from "./tools/git_tag_tool.js";
import {git_worktree_add_tool} from "./tools/git_worktree_add_tool.js";
import {git_worktree_list_tool} from "./tools/git_worktree_list_tool.js";
import {git_worktree_remove_tool} from "./tools/git_worktree_remove_tool.js";
import {server} from "./tools/server.js";
export {server};

export const tools = {
  git_init: git_init_tool,
  git_clone: git_clone_tool,
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
  git_merge: git_merge_tool,
  git_rebase: git_rebase_tool,
  git_stash_push: git_stash_push_tool,
  git_stash_list: git_stash_list_tool,
  git_stash_pop: git_stash_pop_tool,
  git_tag: git_tag_tool,
  git_worktree_add: git_worktree_add_tool,
  git_worktree_list: git_worktree_list_tool,
  git_worktree_remove: git_worktree_remove_tool,
};

export async function startServer(repositoryPath?: string) {
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
