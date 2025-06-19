import assert from "node:assert";
import fs from "node:fs";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {type SimpleGit} from "simple-git";
import {cleanupSandbox, getToolHandler, setupSandbox} from "./test-helper.js";

describe("MCP Git Tools - Scenarios", () => {
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

  test("Scenario 1: Standard Commit Workflow", async () => {
    const statusHandler = getToolHandler("git_status");
    const addHandler = getToolHandler("git_add");
    const commitHandler = getToolHandler("git_commit");
    const logHandler = getToolHandler("git_log");

    fs.writeFileSync(repoPath + "/README.md", "# My Project");

    {
      const {structuredContent} = await statusHandler({repoPath});
      assert.ok(structuredContent.success);
      assert.strictEqual(structuredContent.result.files.find((f: any) => f.path === "README.md")?.workingDirStatus, "Untracked");
    }
    
    await addHandler({repoPath, files: ["README.md"]});

    {
      const {structuredContent} = await statusHandler({repoPath});
      assert.ok(structuredContent.success);
      assert.strictEqual(structuredContent.result.files.find((f: any) => f.path === "README.md")?.indexStatus, "Added");
    }

    const commitResult = await commitHandler({repoPath, message: "feat: Add README"});
    assert.ok(commitResult.structuredContent.success);

    const logResult = await logHandler({repoPath, maxCount: 1});
    assert.ok(logResult.structuredContent.success);
    const {commits} = logResult.structuredContent.result;
    assert.strictEqual(commits.length, 1);
    assert.match(commits[0].message, /feat: Add README/);

    const finalStatusResult = await statusHandler({repoPath});
    assert.ok(finalStatusResult.structuredContent.success);
    assert.strictEqual(finalStatusResult.structuredContent.result.isClean, true);
  });

  test("Scenario 2: Feature Branch & Staging Area Management", async () => {
    const createBranchHandler = getToolHandler("git_create_branch");
    const checkoutHandler = getToolHandler("git_checkout");
    const diffUnstagedHandler = getToolHandler("git_diff_unstaged");
    const diffStagedHandler = getToolHandler("git_diff_staged");
    const addHandler = getToolHandler("git_add");
    const resetHandler = getToolHandler("git_reset");
    const diffHandler = getToolHandler("git_diff");

    fs.writeFileSync(repoPath + "/main.js", "console.log('main');");
    await git.add("main.js").commit("Initial commit on main");

    await createBranchHandler({repoPath, branchName: "feature/new-logic"});
    await checkoutHandler({repoPath, branchName: "feature/new-logic"});

    fs.appendFileSync(repoPath + "/main.js", "\n// new feature");
    fs.writeFileSync(repoPath + "/feature.js", "console.log('feature');");

    {
      const {structuredContent} = await diffUnstagedHandler({repoPath});
      assert.ok(structuredContent.success);
      assert.match(structuredContent.result.diff, /\+\/\/ new feature/);
      assert.match(structuredContent.result.diff, /\+console.log\('feature'\)/);
    }
    
    await addHandler({repoPath, files: ["main.js"]});

    {
      const {structuredContent} = await diffStagedHandler({repoPath});
      assert.ok(structuredContent.success);
      assert.match(structuredContent.result.diff, /\+\/\/ new feature/);
      assert.doesNotMatch(structuredContent.result.diff, /feature.js/);
    }

    await resetHandler({repoPath});

    {
        const {structuredContent} = await diffStagedHandler({repoPath});
        assert.ok(structuredContent.success);
        assert.strictEqual(structuredContent.result.diff, "", "Staged diff should be empty after reset");
    }

    {
        const {structuredContent} = await diffUnstagedHandler({repoPath});
        assert.ok(structuredContent.success);
        assert.match(structuredContent.result.diff, /\+\/\/ new feature/);
        assert.match(structuredContent.result.diff, /feature.js/);
    }

    await addHandler({repoPath, files: ["main.js", "feature.js"]});
    await getToolHandler("git_commit")({repoPath, message: "feat: Implement new logic"});
    
    const finalDiffResult = await diffHandler({repoPath, target: "main"});
    assert.ok(finalDiffResult.structuredContent.success);
    assert.match(finalDiffResult.structuredContent.result.diff, /feature.js/);
  });
});
