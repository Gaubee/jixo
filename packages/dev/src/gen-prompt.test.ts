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

  it("should generate file content from a specific commit in GIT-FILES mode with commitHash", async () => {
    const testFilePath = "src/version1.txt";
    const initialContent = "content from first commit";
    const updatedContent = "content from second commit";
    let firstCommitHash: string;

    // 1. Create and commit the initial file
    await createAndCommitFile(testFilePath, initialContent, "First commit of version1.txt");

    // Get the hash of the first commit
    firstCommitHash = (await git.revparse(["HEAD"])).trim();

    // 2. Update the file and commit again
    fs.writeFileSync(path.join(tempDir, testFilePath), updatedContent, "utf-8");
    await git.add(testFilePath);
    await git.commit("Second commit of version1.txt");

    // 3. Delete the file from the working directory to ensure it's read from history
    fs.unlinkSync(path.join(tempDir, testFilePath));

    // Create the markdown file with GIT-FILES placeholder referencing the first commit
    const mdContent = `
# Test Prompt

[\`${firstCommitHash}:${testFilePath}\`](@GIT-FILES)
    `;
    createMarkdownFile(mdContent);

    // Execute gen_prompt
    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);

    // Assert the output content - should contain initialContent
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain(testFilePath);
    expect(outputContent).toContain("```txt");
    expect(outputContent).toContain(initialContent);
    expect(outputContent).not.toContain(updatedContent); // Ensure it's not the latest content
  });

  it("should generate diff from a specific commit in GIT-DIFF mode with commitHash", async () => {
    const testFilePath = "src/diff_test.txt";
    const contentV1 = "line 1\nline 2\nline 3";
    const contentV2 = "line 1\nchanged line 2\nline 3\nadded line 4";
    let commitV1Hash: string;
    let commitV2Hash: string;

    // 1. Create and commit version 1
    await createAndCommitFile(testFilePath, contentV1, "Commit V1");
    commitV1Hash = (await git.revparse(["HEAD"])).trim();

    // 2. Modify and commit version 2
    fs.writeFileSync(path.join(tempDir, testFilePath), contentV2, "utf-8");
    await git.add(testFilePath);
    await git.commit("Commit V2");
    commitV2Hash = (await git.revparse(["HEAD"])).trim();

    // Create markdown for diff between V1 and V2 (diff of V2 relative to V1)
    const mdContent = `
# Test Prompt

[\`${commitV2Hash}:${testFilePath}\`](@GIT-DIFF)
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
    expect(outputContent).not.toContain(contentV1);
    expect(outputContent).not.toContain(contentV2);
  });

  it("should handle glob patterns with commitHash in GIT-FILES mode", async () => {
    const file1Path = "src/module/file1.js";
    const file2Path = "src/module/file2.ts";
    const file3Path = "src/another/file3.js";
    const content1 = "console.log('file1');";
    const content2 = "console.log('file2');";
    const content3 = "console.log('file3');";
    let commitHash: string;

    await createAndCommitFile(file1Path, content1, "Add file1.js");
    await createAndCommitFile(file2Path, content2, "Add file2.ts");
    await createAndCommitFile(file3Path, content3, "Add file3.js");
    commitHash = (await git.revparse(["HEAD"])).trim();

    // Delete files from working directory to ensure they are read from commit
    fs.unlinkSync(path.join(tempDir, file1Path));
    fs.unlinkSync(path.join(tempDir, file2Path));
    fs.unlinkSync(path.join(tempDir, file3Path));

    const mdContent = `
# Test Prompt

[\`${commitHash}:src/module/*.js\`](@GIT-FILES)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain(file1Path);
    expect(outputContent).toContain(content1);
    expect(outputContent).not.toContain(file2Path); // Should not contain .ts file
    expect(outputContent).not.toContain(content2);
    expect(outputContent).not.toContain(file3Path); // Should not contain file from another directory
    expect(outputContent).not.toContain(content3);
  });

  it("should handle edge case: file exists in working directory but not in commit (GIT-FILES)", async () => {
    const testFilePath = "src/new_file.txt";
    const initialContent = "initial content";
    const uncommittedContent = "uncommitted content";
    let firstCommitHash: string;

    // Commit an initial file (which will be deleted later)
    await createAndCommitFile("src/dummy.txt", "dummy", "Initial dummy commit");
    firstCommitHash = (await git.revparse(["HEAD"])).trim();

    // Create a new file in working directory without committing it
    fs.writeFileSync(path.join(tempDir, testFilePath), uncommittedContent, "utf-8");

    // Create markdown referencing the new file with the *previous* commit hash
    const mdContent = `
# Test Prompt

[\`${firstCommitHash}:${testFilePath}\`](@GIT-FILES)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    // Expect no content for the file from that commit, as it didn't exist then.
    // The "No files found" message from the fix should appear.
    expect(outputContent).toContain(`<!-- No files found for pattern: ${testFilePath} at commit ${firstCommitHash} -->`);
    expect(outputContent).not.toContain(uncommittedContent);
  });

  it("should handle edge case: file exists in working directory but not in commit (GIT-DIFF)", async () => {
    const testFilePath = "src/new_diff_file.txt";
    const uncommittedContent = "new uncommitted content";
    let firstCommitHash: string;

    // Commit an initial file (which will be deleted later)
    await createAndCommitFile("src/another_dummy.txt", "another dummy", "Initial another dummy commit");
    firstCommitHash = (await git.revparse(["HEAD"])).trim();

    // Create a new file in working directory without committing it
    fs.writeFileSync(path.join(tempDir, testFilePath), uncommittedContent, "utf-8");

    // Create markdown referencing the new file with the *previous* commit hash
    const mdContent = `
# Test Prompt

[\`${firstCommitHash}:${testFilePath}\`](@GIT-DIFF)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    // Expect no diff for the file from that commit, as it didn't exist then.
    // The "No files found" message from the fix should appear.
    expect(outputContent).toContain(`<!-- No files found for pattern: ${testFilePath} at commit ${firstCommitHash} -->`);
    expect(outputContent).not.toContain(uncommittedContent);
  });

  it("should generate file content using HEAD~1 as commitHash in GIT-FILES mode", async () => {
    const testFilePath = "src/head_tilde_test.txt";
    const contentV1 = "content of version 1";
    const contentV2 = "content of version 2";

    // 1. Create and commit version 1
    await createAndCommitFile(testFilePath, contentV1, "Commit V1 for HEAD~1 test");

    // 2. Modify and commit version 2
    fs.writeFileSync(path.join(tempDir, testFilePath), contentV2, "utf-8");
    await git.add(testFilePath);
    await git.commit("Commit V2 for HEAD~1 test");

    // 3. Delete the file from the working directory
    fs.unlinkSync(path.join(tempDir, testFilePath));

    // Create markdown referencing HEAD~1 for the file
    const mdContent = `
# Test Prompt

[\`HEAD~1:${testFilePath}\`](@GIT-FILES)
    `;
    createMarkdownFile(mdContent);

    // Execute gen_prompt
    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);

    // Assert the output content - should contain contentV1 (from HEAD~1)
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain(testFilePath);
    expect(outputContent).toContain("```txt");
    expect(outputContent).toContain(contentV1);
    expect(outputContent).not.toContain(contentV2);
  });
});
