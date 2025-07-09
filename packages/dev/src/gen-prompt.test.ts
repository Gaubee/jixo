import {randomUUID} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {simpleGit, type SimpleGit} from "simple-git";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {gen_prompt} from "./gen-prompt.js"; // Assuming gen-prompt.js is the compiled output

describe("gen_prompt FILE/FILE_TREE modes and parameter parsing", () => {
  let tempDir: string;
  let mdFilePath: string;
  let git: SimpleGit; // Add git instance

  beforeEach(async () => { // Make beforeEach async
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gen-prompt-file-test-" + randomUUID()));
    mdFilePath = path.join(tempDir, "test.md");

    // Initialize a new Git repository in the temporary directory for gitignore tests
    git = simpleGit({baseDir: tempDir});
    await git.init();
    await git.addConfig("user.name", "Test User");
    await git.addConfig("user.email", "test@example.com");
  });

  afterEach(async () => { // Make afterEach async
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  const createMarkdownFile = (content: string) => {
    fs.writeFileSync(mdFilePath, content, "utf-8");
  };

  const createTestFile = (filepath: string, content: string) => {
    const fullPath = path.join(tempDir, filepath);
    fs.mkdirSync(path.dirname(fullPath), {recursive: true});
    fs.writeFileSync(fullPath, content, "utf-8");
  };

  it("should parse boolean parameters correctly (e.g., gitignore=true)", async () => {
    createTestFile("test-file.txt", "content");
    await git.add("test-file.txt"); // Commit the file
    await git.commit("Add test-file.txt");

    // Create .gitignore and commit it so globby's gitignore option works
    createTestFile(".gitignore", "*.txt"); 
    await git.add(".gitignore");
    await git.commit("Add .gitignore");

    const mdContent = `
# Test Prompt

[test-file.txt](@FILE?gitignore=true)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    // Expect the file to be ignored due to gitignore=true
    expect(outputContent).toContain("<!-- No files found for pattern: test-file.txt -->");

    // Test with gitignore=false
    const mdContent2 = `
# Test Prompt

[test-file.txt](@FILE?gitignore=false)
    `;
    createMarkdownFile(mdContent2);
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent2 = fs.readFileSync(outputFilePath, "utf-8");

    // Expect the file to be included due to gitignore=false
    expect(outputContent2).toContain("test-file.txt");
    expect(outputContent2).toContain("content");
  });

  it("should generate a file tree for a simple directory structure", async () => {
    createTestFile("dir1/file1.txt", "file1 content");
    createTestFile("dir1/dir2/file2.js", "file2 content");
    createTestFile("file3.md", "file3 content");

    const mdContent = `
# Test Prompt

[**/*](@FILE_TREE)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    // Corrected expectations based on new tree generation logic
    expect(outputContent).toContain("```");
    expect(outputContent).toContain("├── dir1");
    expect(outputContent).toContain("│   ├── dir2");
    expect(outputContent).toContain("│   │   └── file2.js");
    expect(outputContent).toContain("│   └── file1.txt"); // Corrected expectation
    expect(outputContent).toContain("├── file3.md");
    expect(outputContent).toContain("└── test.md");
    expect(outputContent).toMatchSnapshot();
  });

  it("should generate a file tree with expandDirectories=false", async () => {
    createTestFile("dirA/fileA.txt", "content A");
    createTestFile("dirA/dirB/fileB.txt", "content B");
    createTestFile("fileC.txt", "content C");

    const mdContent = `
# Test Prompt

[**/*](@FILE_TREE?expandDirectories=false)
    `;
    createMarkdownFile(mdContent);

    const outputFilePath = path.join(tempDir, "test.gen.md");
    await gen_prompt(mdFilePath, true, outputFilePath);
    const outputContent = fs.readFileSync(outputFilePath, "utf-8");

    // Expect only top-level files/directories
    expect(outputContent).toContain("```");
    expect(outputContent).toContain("├── dirA");
    expect(outputContent).toContain("├── fileC.txt");
    expect(outputContent).toContain("└── test.md");
    expect(outputContent).not.toContain("fileA.txt");
    expect(outputContent).not.toContain("dirB");
    expect(outputContent).not.toContain("fileB.txt");
    expect(outputContent).toMatchSnapshot();
  });
});
