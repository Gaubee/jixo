import {randomUUID} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {simpleGit, type SimpleGit} from "simple-git";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {gen_prompt} from "./gen-prompt.js";

describe("gen_prompt GIT modes", (t) => {
  let tempDir: string;
  let git: SimpleGit;
  let mdFilePath: string;

  beforeEach(async () => {
    // Create a temporary directory for the Git repository and test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gen-prompt-git-test-" + randomUUID()));
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
    expect(outputContent).toContain(`\`${testFilePath} (Modified)\``);
    expect(outputContent).toContain("-line 2");
    expect(outputContent).toContain("+changed line 2");
    expect(outputContent).toContain("+added line 4");
  });

  it("should generate file content for an unstaged file in GIT_FILE mode", async () => {
    // Setup: Create a file, commit it, then modify it without committing
    const testFilePath = "src/example.txt";
    await createAndCommitFile(testFilePath, "original content", "Initial commit");

    const modifiedContent = "new content for the file";
    fs.writeFileSync(path.join(tempDir, testFilePath), modifiedContent, "utf-8");

    // Create the markdown file with GIT_FILE placeholder
    const mdContent = `
# Test Prompt

[\`${testFilePath}\`](@GIT_FILE)
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

  it("should generate file content from a specific commit in GIT_FILE mode with commitHash", async () => {
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

    // Create the markdown file with GIT_FILE placeholder referencing the first commit
    const mdContent = `
# Test Prompt

[\`${firstCommitHash}:${testFilePath}\`](@GIT_FILE)
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
    expect(outputContent).toContain(`\`${testFilePath} (Modified)\``);
    expect(outputContent).toContain("-line 2");
    expect(outputContent).toContain("+changed line 2");
    expect(outputContent).toContain("+added line 4");
    expect(outputContent).not.toContain(contentV1);
    expect(outputContent).not.toContain(contentV2);
  });

  it("should handle glob patterns with commitHash in GIT_FILE mode", async () => {
    const file1Path = "src/module/file1.js";
    const file2Path = "src/module/file2.ts";
    const file3Path = "src/another/file3.js";
    const content1 = "console.log('file1');";
    const content2 = "console.log('file2');";
    const content3 = "console.log('file3');";
    let commitHash: string;

    await createAndCommitFile(file1Path, content1, "Add file1.js");
    commitHash = (await git.revparse(["HEAD"])).trim();
    await createAndCommitFile(file2Path, content2, "Add file2.ts");
    await createAndCommitFile(file3Path, content3, "Add file3.js");

    // Delete files from working directory to ensure they are read from commit
    fs.unlinkSync(path.join(tempDir, file1Path));
    fs.unlinkSync(path.join(tempDir, file2Path));
    fs.unlinkSync(path.join(tempDir, file3Path));

    const mdContent = `
# Test Prompt

[\`${commitHash}:src/module/*.js\`](@GIT_FILE)
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

  it("should generate file content for a tracked, unmodified file in GIT_FILE mode (working dir)", async () => {
    const testFilePath = "src/tracked_unmodified.txt";
    const content = "This is some content for a tracked file.";
    await createAndCommitFile(testFilePath, content, "Tracked unmodified file");

    const mdContent = `
# Test Prompt

[\`${testFilePath}\`](@GIT_FILE)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain(`<!-- No files found for pattern: ${testFilePath} in working directory -->`);
    expect(outputContent).not.toContain(content);
  });

  it("should generate file content for a newly added, untracked file in GIT_FILE mode (working dir)", async () => {
    const testFilePath = "src/new_untracked.txt";
    const content = "Content of a brand new untracked file.";
    const fullPath = path.join(tempDir, testFilePath);
    fs.mkdirSync(path.dirname(fullPath), {recursive: true});
    fs.writeFileSync(fullPath, content, "utf-8");

    const mdContent = `
# Test Prompt

[\`${testFilePath}\`](@GIT_FILE)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain(testFilePath);
    expect(outputContent).toContain("```txt");
    expect(outputContent).toContain(content);
  });

  it("should NOT generate content for an ignored file in GIT_FILE mode (working dir)", async () => {
    // Create .gitignore
    fs.writeFileSync(path.join(tempDir, ".gitignore"), "*.log\n", "utf-8");
    // Create an ignored file
    const ignoredFilePath = "src/debug.log";
    const ignoredContent = "This log should be ignored.";
    const fullPathIgnored = path.join(tempDir, ignoredFilePath);
    fs.mkdirSync(path.dirname(fullPathIgnored), {recursive: true});
    fs.writeFileSync(fullPathIgnored, ignoredContent, "utf-8");

    const mdContent = `
# Test Prompt

[\`${ignoredFilePath}\`](@GIT_FILE)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain(`<!-- No files found for pattern: ${ignoredFilePath} in working directory -->`);
    expect(outputContent).not.toContain(ignoredContent);
  });

  it("should generate diff for a newly added, untracked file in GIT-DIFF mode (working dir)", async () => {
    const testFilePath = "src/new_untracked_diff.txt";
    const content = "This is a new file to be diffed.";
    const fullPathDiff = path.join(tempDir, testFilePath);
    fs.mkdirSync(path.dirname(fullPathDiff), {recursive: true});
    fs.writeFileSync(fullPathDiff, content, "utf-8");

    const mdContent = `
# Test Prompt

[\`${testFilePath}\`](@GIT-DIFF)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain("```diff");
    expect(outputContent).toContain(`+${content}`);
  });

  it("should generate diff for a deleted file in GIT-DIFF mode (working dir)", async () => {
    const testFilePath = "src/deleted_file.txt";
    const content = "Content of a file that will be deleted.";
    await createAndCommitFile(testFilePath, content, "File to be deleted");

    fs.unlinkSync(path.join(tempDir, testFilePath)); // Delete the file

    const mdContent = `
# Test Prompt

[\`${testFilePath}\`](@GIT-DIFF)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain("```diff");
    expect(outputContent).toContain(`\`${testFilePath} (Deleted)\``);
    expect(outputContent).toContain(`-${content}`);
  });

  it("should handle glob patterns for working directory files in GIT_FILE mode", async () => {
    const file1Path = "src/data/report.csv";
    const file2Path = "src/data/config.json";
    const file3Path = "src/assets/image.png"; // Should not be included by glob
    const content1 = "header1,header2\nvalue1,value2";
    const content2 = '{"key": "value"}';
    const content3 = "binary_image_data";

    // Create and commit some files
    await createAndCommitFile("src/existing.txt", "existing content", "Existing file");

    // Create new untracked files
    const fullPath1 = path.join(tempDir, file1Path);
    fs.mkdirSync(path.dirname(fullPath1), {recursive: true});
    fs.writeFileSync(fullPath1, content1, "utf-8");

    const fullPath2 = path.join(tempDir, file2Path);
    fs.mkdirSync(path.dirname(fullPath2), {recursive: true});
    fs.writeFileSync(fullPath2, content2, "utf-8");

    const fullPath3 = path.join(tempDir, file3Path);
    fs.mkdirSync(path.dirname(fullPath3), {recursive: true});
    fs.writeFileSync(fullPath3, content3, "utf-8");

    const mdContent = `
# Test Prompt

[\`src/data/*\`](@GIT_FILE)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    expect(outputContent).toContain(file1Path);
    expect(outputContent).toContain("```csv");
    expect(outputContent).toContain(content1);

    expect(outputContent).toContain(file2Path);
    expect(outputContent).toContain("```json");
    expect(outputContent).toContain(content2);

    expect(outputContent).not.toContain(file3Path); // Should not match the glob
    expect(outputContent).not.toContain(content3);
  });

  it("should handle edge case: file exists in working directory but not in commit (GIT_FILE)", async () => {
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

[\`${firstCommitHash}:${testFilePath}\`](@GIT_FILE)
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

  it("should generate file content using HEAD~1 as commitHash in GIT_FILE mode", async () => {
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

[\`HEAD~1:${testFilePath}\`](@GIT_FILE)
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
