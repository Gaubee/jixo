import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {type SimpleGit} from "simple-git";
import {cleanupSandbox, getToolHandler, setupSandbox} from "./test-helper.js";

describe("MCP Git Tools - Worktree Scenarios", () => {
  let sandboxPath: string;
  let mainRepoPath: string;
  let git: SimpleGit;

  beforeEach(async () => {
    mock.restoreAll();
    const setup = setupSandbox();
    sandboxPath = setup.sandboxPath;
    const repo = await setup.initRepo();
    mainRepoPath = repo.repoPath;
    git = repo.git;

    fs.writeFileSync(path.join(mainRepoPath, "main.txt"), "main content");
    await git.add("main.txt").commit("Initial commit");
  });

  afterEach(() => {
    cleanupSandbox(sandboxPath);
  });

  test("should handle the full worktree lifecycle with successful merge", async () => {
    const worktreeAdd = getToolHandler("git_worktree_add");
    const worktreeList = getToolHandler("git_worktree_list");
    const worktreeRemove = getToolHandler("git_worktree_remove");
    const add = getToolHandler("git_add");
    const commit = getToolHandler("git_commit");
    const merge = getToolHandler("git_merge");

    const featureWorktreePath = path.join(sandboxPath, "feature-branch-worktree");

    // 1. Create a new worktree for a new feature branch
    const addResult = await worktreeAdd({
      repoPath: mainRepoPath,
      path: featureWorktreePath,
      branch: "feature/new-feature",
      createBranch: true,
    });
    assert.ok(!addResult.isError, "Worktree add should be successful");
    assert.ok(fs.existsSync(featureWorktreePath), "Worktree directory should be created");

    // 2. List worktrees and verify the new one exists
    const listResult = await worktreeList({repoPath: mainRepoPath});
    const worktrees = listResult.structuredContent.worktrees;
    assert.ok(worktrees);
    assert.strictEqual(worktrees.length, 2, "Should be two worktrees (main and feature)");
    const featureWorktreeInfo = worktrees.find((w: any) => path.resolve(w.path) === path.resolve(featureWorktreePath));
    assert.ok(featureWorktreeInfo, "Feature worktree should be in the list");
    assert.strictEqual(featureWorktreeInfo.branch, "feature/new-feature");

    // 3. Perform work in the new worktree (add, commit)
    fs.writeFileSync(path.join(featureWorktreePath, "feature.txt"), "feature content");
    await add({repoPath: featureWorktreePath, files: ["feature.txt"]});
    await commit({repoPath: featureWorktreePath, message: "Implement new feature"});

    // 4. Switch back to main worktree and merge the feature branch
    await git.checkout("main");
    const mergeResult = await merge({repoPath: mainRepoPath, branch: "feature/new-feature"});
    assert.strictEqual(mergeResult.structuredContent.success, true, "Merge should be successful");

    // 5. Verify the merge commit
    const log = await git.log();
    assert.match(log.latest!.message, /Implement new feature/);

    // 6. Remove the worktree
    await worktreeRemove({repoPath: mainRepoPath, path: featureWorktreePath});

    // 7. Verify it's gone from the list
    const finalListResult = await worktreeList({repoPath: mainRepoPath});
    assert.ok(finalListResult.structuredContent.worktrees);
    assert.strictEqual(finalListResult.structuredContent.worktrees.length, 1, "Worktree list should have 1 entry after removal");
  });

  test("should handle merge conflicts gracefully", async () => {
    const worktreeAdd = getToolHandler("git_worktree_add");
    const add = getToolHandler("git_add");
    const commit = getToolHandler("git_commit");
    const merge = getToolHandler("git_merge");

    const featureWorktreePath = path.join(sandboxPath, "conflict-worktree");

    await worktreeAdd({
      repoPath: mainRepoPath,
      path: featureWorktreePath,
      branch: "feature/conflict",
      createBranch: true,
    });

    // Create a conflict
    fs.writeFileSync(path.join(mainRepoPath, "main.txt"), "main change");
    await git.add("main.txt").commit("Update main in main branch");

    fs.writeFileSync(path.join(featureWorktreePath, "main.txt"), "feature change");
    await add({repoPath: featureWorktreePath, files: ["main.txt"]});
    await commit({repoPath: featureWorktreePath, message: "Update main in feature branch"});

    // Attempt to merge, expecting a conflict
    await git.checkout("main");
    const mergeResult = await merge({repoPath: mainRepoPath, branch: "feature/conflict"});

    assert.strictEqual(mergeResult.isError, true);
    const structured = mergeResult.structuredContent;
    assert.strictEqual(structured.success, false);
    assert.ok(structured.error);
    assert.strictEqual(structured.error.name, "MergeConflictError");
    assert.deepStrictEqual(structured.error.conflicts, ["main.txt"]);
    assert.ok(structured.error.remedy_tool_suggestions);
    assert.ok(structured.error.remedy_tool_suggestions.length > 0);
  });
});
