import type {CallToolResult, TextContent} from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert";
import fs from "node:fs";
import {afterEach, beforeEach, describe, mock, test} from "node:test";
import {type SimpleGit} from "simple-git";
import {cleanupSandbox, getToolHandler, setupSandbox} from "./test-helper.js";

function getResultText(result: Pick<CallToolResult, "content">): string {
  const textContent = result.content?.find((c) => c.type === "text") as TextContent;
  return textContent?.text || "";
}

describe("MCP Git Tools - Structured Output", () => {
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

    fs.writeFileSync(repoPath + "/a.txt", "a");
    fs.writeFileSync(repoPath + "/b.txt", "b");
    await git.add(["a.txt", "b.txt"]);
    await git.commit("initial commit");
  });

  afterEach(() => {
    cleanupSandbox(sandboxPath);
  });

  test("`git_status` should produce correct structured and text output for complex states", async () => {
    fs.appendFileSync(repoPath + "/a.txt", "\nmodified");
    await git.mv("b.txt", "b_renamed.txt");
    fs.writeFileSync(repoPath + "/c.txt", "c");
    await git.add("c.txt");
    fs.writeFileSync(repoPath + "/d.txt", "d");

    const handler = getToolHandler("git_status");
    const result = await handler({repoPath});

    assert.ok(result.structuredContent.success);
    const structuredResult = result.structuredContent.result;
    const textOutput = getResultText(result);

    assert.ok(structuredResult.files);
    assert.deepStrictEqual(structuredResult.files.find((f: any) => f.path === "a.txt")?.workingDirStatus, "Modified");
    assert.deepStrictEqual(structuredResult.files.find((f: any) => f.path.includes("b_renamed.txt"))?.indexStatus, "Renamed");

    assert.match(textOutput, /Renamed:\s+b.txt -> b_renamed.txt/);
    assert.match(textOutput, /Modified:\s+a.txt/);
    assert.match(textOutput, /Added:\s+c.txt/);
    assert.match(textOutput, /Untracked files:/);
    assert.match(textOutput, /\s+d.txt/);
  });

  test("`git_commit` should return a structured hash", async () => {
    fs.writeFileSync(repoPath + "/commit_test.txt", "data");
    await git.add("commit_test.txt");
    const handler = getToolHandler("git_commit");
    const result = await handler({repoPath, message: "commit test"});

    assert.ok(result.structuredContent.success);
    assert.match(result.structuredContent.result.commitHash, /^[0-9a-f]{7,40}$/);
  });

  test("`git_log` should return structured commits", async () => {
    fs.writeFileSync(repoPath + "/log_test.txt", "data");
    await git.add("log_test.txt");
    await git.commit("second commit");
    const handler = getToolHandler("git_log");
    const result = await handler({repoPath, maxCount: 2});

    assert.ok(result.structuredContent.success);
    const commits = result.structuredContent.result.commits;
    assert.strictEqual(commits.length, 2);
    assert.strictEqual(commits[0].message.trim(), "second commit");
    assert.strictEqual(commits[1].message.trim(), "initial commit");
  });

  test("`git_diff_staged` should return structured diff", async () => {
    fs.appendFileSync(repoPath + "/a.txt", "\nnew line");
    await git.add("a.txt");
    const handler = getToolHandler("git_diff_staged");
    const result = await handler({repoPath});

    assert.ok(result.structuredContent.success);
    const diff = result.structuredContent.result.diff;
    assert.match(diff, /diff --git a\/a.txt b\/a.txt/);
    assert.match(diff, /\+new line/);
  });

  test("`git_show` should return structured diff of a commit", async () => {
    const log = await git.log();
    const commitHash = log.latest!.hash;

    const handler = getToolHandler("git_show");
    const result = await handler({repoPath, revision: commitHash});

    assert.ok(result.structuredContent.success);
    const diff = result.structuredContent.result.diff;
    assert.match(diff, new RegExp(`commit ${commitHash}`));
    assert.match(diff, /diff --git a\/a.txt b\/a.txt/);
  });
});
