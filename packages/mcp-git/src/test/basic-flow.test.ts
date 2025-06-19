import assert from "node:assert";
import fs from "node:fs";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {type SimpleGit} from "simple-git";
import {cleanupSandbox, getToolHandler, setupSandbox} from "./test-helper.js";

describe("MCP Git Tools - Basic Flow", () => {
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

    fs.writeFileSync(repoPath + "/test.txt", "initial content");
    await git.add("test.txt");
    await git.commit("initial commit");
  });

  afterEach(() => {
    cleanupSandbox(sandboxPath);
  });

  test("`git_init` should initialize a new repository", async () => {
    const handler = getToolHandler("git_init");
    const newRepoPath = sandboxPath + "/new_repo";
    const result = await handler({repoPath: newRepoPath});
    assert.ok(result.structuredContent.success);
    assert.ok(fs.existsSync(newRepoPath + "/.git"));
  });

  test("`git_add` and `git_commit` should work together", async () => {
    const addHandler = getToolHandler("git_add");
    const commitHandler = getToolHandler("git_commit");
    const newFilePath = repoPath + "/new-file.txt";
    fs.writeFileSync(newFilePath, "some data");

    const addResult = await addHandler({repoPath: repoPath, files: ["new-file.txt"]});
    assert.ok(addResult.structuredContent.success);

    const commitResult = await commitHandler({repoPath: repoPath, message: "feat: add new feature"});
    assert.ok(commitResult.structuredContent.success);
    assert.ok(commitResult.structuredContent.result.commitHash.length > 0);
  });

  test("`git_create_branch` and `git_checkout` should manage branches", async () => {
    const createHandler = getToolHandler("git_create_branch");
    const checkoutHandler = getToolHandler("git_checkout");

    await createHandler({repoPath, branchName: "feature-branch"});
    await checkoutHandler({repoPath, branchName: "feature-branch"});

    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
    assert.strictEqual(currentBranch, "feature-branch");
  });

  test("`git_log` should retrieve commit history", async () => {
    const handler = getToolHandler("git_log");
    const result = await handler({repoPath: repoPath, maxCount: 1});

    assert.ok(result.structuredContent.success);
    const commits = result.structuredContent.result.commits;
    assert.strictEqual(commits.length, 1);
    assert.strictEqual(commits[0].message.trim(), "initial commit");
  });

  test("`git_status` should report a clean state", async () => {
    const handler = getToolHandler("git_status");
    const result = await handler({repoPath: repoPath});
    assert.ok(result.structuredContent.success);
    assert.strictEqual(result.structuredContent.result.isClean, true);
  });
});
