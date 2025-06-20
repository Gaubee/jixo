import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {type SimpleGit} from "simple-git";
import {cleanupSandbox, getToolHandler, setupSandbox} from "./test-helper.js";

describe("MCP Git Tools - Advanced Scenarios", () => {
  let sandboxPath: string;
  let repoPath: string;
  let git: SimpleGit;

  beforeEach(async () => {
    mock.restoreAll();
    const setup = setupSandbox();
    sandboxPath = setup.sandboxPath;
    const repo = await setup.initRepo();
    repoPath = repo.repoPath;
    git = repo.git;
  });

  afterEach(() => {
    cleanupSandbox(sandboxPath);
  });

  test("Stash workflow: stash, work on something else, pop stash", async () => {
    const stashPush = getToolHandler("git_stash_push");
    const stashList = getToolHandler("git_stash_list");
    const stashPop = getToolHandler("git_stash_pop");
    const status = getToolHandler("git_status");

    // 1. Initial state and make some changes
    fs.writeFileSync(path.join(repoPath, "index.js"), "console.log('v1');");
    await git.add(".").commit("v1");
    fs.appendFileSync(path.join(repoPath, "index.js"), "\n// WIP feature");

    // 2. Stash the WIP changes
    await stashPush({repoPath, message: "wip-feature"});
    let statusResult = await status({repoPath});
    assert.ok(statusResult.structuredContent.success);
    assert.strictEqual(statusResult.structuredContent.result.isClean, true, "Workspace should be clean after stash");

    // 3. List stashes
    const {structuredContent} = await stashList({repoPath});
    assert.ok(structuredContent.success);
    const stashes = structuredContent.result.stashes;
    assert.ok(stashes);
    assert.strictEqual(stashes.length, 1);
    assert.match(stashes[0].message, /wip-feature/);

    // 4. Pop the stash
    await stashPop({repoPath});
    statusResult = await status({repoPath});
    assert.ok(statusResult.structuredContent.success);
    assert.strictEqual(statusResult.structuredContent.result.isClean, false, "Workspace should be dirty after pop");
    const content = fs.readFileSync(path.join(repoPath, "index.js"), "utf-8");
    assert.ok(content.includes("WIP feature"));
  });

  test("Rebase workflow: create feature, update main, rebase feature", async () => {
    const rebase = getToolHandler("git_rebase");
    const checkout = getToolHandler("git_checkout");

    // 1. Initial commit
    fs.writeFileSync(path.join(repoPath, "base.txt"), "base");
    await git.add(".").commit("Initial");

    // 2. Create and checkout feature branch, add a commit
    await git.checkout(["-b", "feature"]);
    fs.writeFileSync(path.join(repoPath, "feature.txt"), "feature");
    await git.add(".").commit("Feat: Add feature file");

    // 3. Switch back to main and add another commit
    await checkout({repoPath, branchName: "main"});
    fs.writeFileSync(path.join(repoPath, "update.txt"), "update");
    await git.add(".").commit("Update on main");
    const mainCommitCount = (await git.log()).total;
    assert.strictEqual(mainCommitCount, 2);

    // 4. Switch back to feature and rebase onto main
    await checkout({repoPath, branchName: "feature"});
    await rebase({repoPath, baseBranch: "main"});

    // 5. Verify history is linear and contains all commits
    const log = await git.log();
    assert.strictEqual(log.total, 3, "History should be linear with 3 commits");
    assert.match(log.all[0].message, /Feat: Add feature file/);
    assert.match(log.all[1].message, /Update on main/);
  });
});
