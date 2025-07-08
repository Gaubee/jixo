import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {simpleGit, type SimpleGit} from "simple-git";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {gen_prompt} from "./gen-prompt.js"; // Assuming gen-prompt.js is the compiled output

describe("gen_prompt GIT modes", () => {
  let tempDir: string;
  let git: SimpleGit;
  let mdFilePath: string;

  beforeEach(async () => {
    // Create a temporary directory for the Git repository and test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gen-prompt-git-test-"));
    mdFilePath = path.join(tempDir, "test.md");

    // Initialize a new Git repository in the temporary directory
    git = simpleGit({baseDir: tempDir});
    await git.init();
    await git.addConfig("user.name", "Test User");
    await git.addConfig("user.email", "test@example.com");
  });

  afterEach(async () => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  const createMarkdownFile = (content: string) => {
    fs.writeFileSync(mdFilePath, content, "utf-8");
  };

  const createAndCommitFile = async (filepath: string, content: string, commitMessage: string) => {
    const fullPath = path.join(tempDir, filepath);
    fs.mkdirSync(path.dirname(fullPath), {recursive: true});
    fs.writeFileSync(fullPath, content, "utf-8");
    await git.add(filepath);
    await git.commit(commitMessage);
  };

  it("should generate diff for an unstaged file in GIT-DIFF mode", async () => {
    // Setup: Create a file, commit it, then modify it without committing
    const testFilePath = "src/example.txt";
    await createAndCommitFile(testFilePath, "line 1\nline 2\nline 3\n", "Initial commit");

    // Modify the file unstaged
    fs.writeFileSync(path.join(tempDir, testFilePath), "line 1\nchanged line 2\nline 3\nadded line 4\n", "utf-8");

    // Create the markdown file with GIT-DIFF placeholder
    const mdContent = `
# Test Prompt

[\`${testFilePath}\`](@GIT-DIFF)
    `;
    createMarkdownFile(mdContent);

    // Execute gen_prompt
    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    // Assert the output content
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain("```diff");
    expect(outputContent).toContain(`--- a/${testFilePath}`);
    expect(outputContent).toContain(`+++ b/${testFilePath}`);
    expect(outputContent).toContain("-line 2");
    expect(outputContent).toContain("+changed line 2");
    expect(outputContent).toContain("+added line 4");
  });

  it("should generate file content for an unstaged file in GIT-FILES mode", async () => {
    // Setup: Create a file, commit it, then modify it without committing
    const testFilePath = "src/example.txt";
    await createAndCommitFile(testFilePath, "original content", "Initial commit");

    const modifiedContent = "new content for the file";
    fs.writeFileSync(path.join(tempDir, testFilePath), modifiedContent, "utf-8");

    // Create the markdown file with GIT-FILES placeholder
    const mdContent = `
# Test Prompt

[\`${testFilePath}\`](@GIT-FILES)
    `;
    createMarkdownFile(mdContent);

    // Execute gen_prompt
    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);

    // Assert the output content
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain(testFilePath);
    expect(outputContent).toContain("```txt"); // Assuming .txt extension
    expect(outputContent).toContain(modifiedContent);
  });
});
