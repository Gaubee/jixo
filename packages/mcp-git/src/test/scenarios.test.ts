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

    // 1. Create a new file, repo is dirty
    fs.writeFileSync(repoPath + "/README.md", "# My Project");

    // 2. Check status, should show untracked file
    let statusResult = await statusHandler({repoPath});
    let structuredStatus = statusResult.structuredContent as any;
    assert.strictEqual(structuredStatus.files.find((f: any) => f.path === "README.md")?.workingDirStatus, "Untracked");

    // 3. Add the file to staging
    await addHandler({repoPath, files: ["README.md"]});

    // 4. Check status, should show file as staged
    statusResult = await statusHandler({repoPath});
    structuredStatus = statusResult.structuredContent as any;
    assert.strictEqual(structuredStatus.files.find((f: any) => f.path === "README.md")?.indexStatus, "Added");

    // 5. Commit the file
    const commitResult = await commitHandler({repoPath, message: "feat: Add README"});
    assert.strictEqual((commitResult.structuredContent as any).success, true);

    // 6. Check log, new commit should be on top
    const logResult = await logHandler({repoPath, maxCount: 1});
    const structuredLog = logResult.structuredContent as any;
    assert.strictEqual(structuredLog.commits.length, 1);
    assert.match(structuredLog.commits[0].message, /feat: Add README/);

    // 7. Check status, repo should be clean
    statusResult = await statusHandler({repoPath});
    structuredStatus = statusResult.structuredContent as any;
    assert.strictEqual(structuredStatus.isClean, true);
  });

  test("Scenario 2: Feature Branch & Staging Area Management", async () => {
    // Tool handlers
    const createBranchHandler = getToolHandler("git_create_branch");
    const checkoutHandler = getToolHandler("git_checkout");
    const diffUnstagedHandler = getToolHandler("git_diff_unstaged");
    const diffStagedHandler = getToolHandler("git_diff_staged");
    const addHandler = getToolHandler("git_add");
    const resetHandler = getToolHandler("git_reset");
    const diffHandler = getToolHandler("git_diff");

    // Step 1: Initial commit on main branch
    fs.writeFileSync(repoPath + "/main.js", "console.log('main');");
    await git.add("main.js").commit("Initial commit on main");

    // Step 2: Create and checkout a feature branch
    await createBranchHandler({repoPath, branchName: "feature/new-logic"});
    await checkoutHandler({repoPath, branchName: "feature/new-logic"});
    // State: On branch 'feature/new-logic', clean working directory.

    // Step 3: Make changes in the working directory
    fs.appendFileSync(repoPath + "/main.js", "\n// new feature");
    fs.writeFileSync(repoPath + "/feature.js", "console.log('feature');");
    // State: main.js is modified, feature.js is untracked.

    // Step 4: Verify unstaged diff shows all working directory changes
    let diffResult = await diffUnstagedHandler({repoPath});
    let structuredDiff = diffResult.structuredContent as any;
    assert.match(structuredDiff.diff, /\+\/\/ new feature/);
    assert.match(structuredDiff.diff, /\+console.log\('feature'\)/);

    // Step 5: Stage only one of the two changes
    await addHandler({repoPath, files: ["main.js"]});
    // State: main.js changes are staged, feature.js is still untracked.

    // Step 6: Verify staged diff contains only the staged changes
    diffResult = await diffStagedHandler({repoPath});
    structuredDiff = diffResult.structuredContent as any;
    assert.match(structuredDiff.diff, /\+\/\/ new feature/);
    assert.doesNotMatch(structuredDiff.diff, /feature.js/);

    // Step 7: Reset the staging area
    await resetHandler({repoPath});
    // State: All staged changes (main.js) are moved back to the working directory.

    // Step 8: Verify the staging area is now empty
    const stagedDiffAfterReset = await diffStagedHandler({repoPath});
    assert.strictEqual((stagedDiffAfterReset.structuredContent as any).diff, "", "Staged diff should be empty after reset");

    // Step 9: Verify the working directory now contains all changes again
    const unstagedDiffAfterReset = await diffUnstagedHandler({repoPath});
    assert.match((unstagedDiffAfterReset.structuredContent as any).diff, /\+\/\/ new feature/);
    assert.match((unstagedDiffAfterReset.structuredContent as any).diff, /feature.js/);

    // Step 10: Final commit and comparison
    await addHandler({repoPath, files: ["main.js", "feature.js"]});
    await getToolHandler("git_commit")({repoPath, message: "feat: Implement new logic"});
    diffResult = await diffHandler({repoPath, target: "main"});
    structuredDiff = diffResult.structuredContent as any;
    assert.match(structuredDiff.diff, /feature.js/);
  });
});
