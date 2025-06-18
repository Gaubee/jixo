# mcp-git: A git MCP server

## Overview

A Model Context Protocol server for Git repository interaction and automation. This server provides tools to read, search, and manipulate Git repositories via Large Language Models.

This project is a TypeScript implementation, providing robust, type-safe tools for interacting with Git repositories.

### Tools

1.  **`git_status`**

    - Shows the working tree status.
    - Input: `{ repoPath: string }`
    - Returns: Current status of the working directory as text output.

2.  **`git_diff_unstaged`**

    - Shows changes in the working directory not yet staged.
    - Input: `{ repoPath: string }`
    - Returns: Diff output of unstaged changes.

3.  **`git_diff_staged`**

    - Shows changes that are staged for commit.
    - Input: `{ repoPath: string }`
    - Returns: Diff output of staged changes.

4.  **`git_diff`**

    - Shows differences between the current state and a branch or commit.
    - Input: `{ repoPath: string, target: string }`
    - Returns: Diff output comparing the current state with the target.

5.  **`git_commit`**

    - Records changes to the repository.
    - Input: `{ repoPath: string, message: string }`
    - Returns: Confirmation with the new commit hash.

6.  **`git_add`**

    - Adds file contents to the staging area.
    - Input: `{ repoPath: string, files: string[] }`
    - Returns: Confirmation of staged files.

7.  **`git_reset`**

    - Unstages all staged changes.
    - Input: `{ repoPath: string }`
    - Returns: Confirmation of the reset operation.

8.  **`git_log`**

    - Shows the commit logs.
    - Input: `{ repoPath: string, maxCount?: number }` (default: 10)
    - Returns: Formatted string of commit entries.

9.  **`git_create_branch`**

    - Creates a new branch.
    - Input: `{ repoPath: string, branchName: string, baseBranch?: string }`
    - Returns: Confirmation of branch creation.

10. **`git_checkout`**

    - Switches branches.
    - Input: `{ repoPath: string, branchName: string }`
    - Returns: Confirmation of the branch switch.

11. **`git_show`**

    - Shows the contents and metadata of a commit.
    - Input: `{ repoPath: string, revision: string }`
    - Returns: Contents of the specified commit.

12. **`git_init`**
    - Initializes a Git repository.
    - Input: `{ repoPath: string }`
    - Returns: Confirmation of repository initialization.

## Installation & Usage

It's recommended to run this tool using `npx` to ensure you are always using the latest version without global installation.

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:
