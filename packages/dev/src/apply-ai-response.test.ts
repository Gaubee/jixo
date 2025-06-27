import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {applyAiResponse} from "./apply-ai-response.js";

describe("applyAiResponse", () => {
  let tempDir: string;
  let mdFilePath: string;

  beforeEach(() => {
    // 创建一个临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "apply-ai-test-"));
    mdFilePath = path.join(tempDir, "changes.md");
  });

  afterEach(() => {
    // 清理临时目录
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  const createMarkdownFile = (content: string) => {
    fs.writeFileSync(mdFilePath, content, "utf-8");
  };

  it("should add a new file correctly", async () => {
    const mdContent = `
#### \`src/new-file.txt\`
\`\`\`
Hello, new file!
\`\`\`
    `;
    createMarkdownFile(mdContent);

    await applyAiResponse(mdFilePath, {yes: true, cwd: tempDir});

    const newFilePath = path.join(tempDir, "src", "new-file.txt");
    expect(fs.existsSync(newFilePath)).toBe(true);
    const fileContent = fs.readFileSync(newFilePath, "utf-8");
    expect(fileContent.trim()).toBe("Hello, new file!");
  });

  it("should modify an existing file correctly", async () => {
    const existingFilePath = path.join(tempDir, "existing-file.txt");
    fs.writeFileSync(existingFilePath, "Original content.", "utf-8");

    const mdContent = `
#### \`existing-file.txt\`
\`\`\`
Updated content.
\`\`\`
    `;
    createMarkdownFile(mdContent);

    await applyAiResponse(mdFilePath, {yes: true, cwd: tempDir});

    const fileContent = fs.readFileSync(existingFilePath, "utf-8");
    expect(fileContent.trim()).toBe("Updated content.");
  });

  it("should delete a file correctly", async () => {
    const fileToDeletePath = path.join(tempDir, "to-delete.txt");
    fs.writeFileSync(fileToDeletePath, "This file will be deleted.", "utf-8");

    const mdContent = `
#### \`to-delete.txt\`
\`\`\`
$$DELETE_FILE$$
\`\`\`
    `;
    createMarkdownFile(mdContent);

    await applyAiResponse(mdFilePath, {yes: true, cwd: tempDir});

    expect(fs.existsSync(fileToDeletePath)).toBe(false);
  });

  it("should rename a file correctly", async () => {
    const oldPath = path.join(tempDir, "old-name.txt");
    const newPath = path.join(tempDir, "new-name.txt");
    const originalContent = "This content should be preserved.";
    fs.writeFileSync(oldPath, originalContent, "utf-8");

    const mdContent = `
#### \`old-name.txt\`
\`\`\`
$$RENAME_FILE$$new-name.txt
\`\`\`
    `;
    createMarkdownFile(mdContent);

    await applyAiResponse(mdFilePath, {yes: true, cwd: tempDir});

    expect(fs.existsSync(oldPath)).toBe(false);
    expect(fs.existsSync(newPath)).toBe(true);
    const newContent = fs.readFileSync(newPath, "utf-8");
    expect(newContent).toBe(originalContent);
  });

  it("should handle multiple operations in a single run", async () => {
    // Setup initial state
    const modifyFilePath = path.join(tempDir, "to-modify.js");
    const deleteFilePath = path.join(tempDir, "to-delete.css");
    fs.mkdirSync(path.join(tempDir, "src"));
    fs.writeFileSync(modifyFilePath, "console.log('old');", "utf-8");
    fs.writeFileSync(deleteFilePath, "body { color: red; }", "utf-8");

    const mdContent = `
#### \`src/new-component.tsx\`
\`\`\`tsx
export const MyComponent = () => <div>Hello</div>;
\`\`\`

#### \`to-modify.js\`
\`\`\`javascript
console.log('new');
\`\`\`

#### \`to-delete.css\`
\`\`\`
$$DELETE_FILE$$
\`\`\`
    `;
    createMarkdownFile(mdContent);

    await applyAiResponse(mdFilePath, {yes: true, cwd: tempDir});

    // Assertions
    const newFilePath = path.join(tempDir, "src", "new-component.tsx");
    expect(fs.existsSync(newFilePath)).toBe(true);
    expect(fs.readFileSync(newFilePath, "utf-8")).toContain("Hello");

    expect(fs.readFileSync(modifyFilePath, "utf-8").trim()).toBe("console.log('new');");
    expect(fs.existsSync(deleteFilePath)).toBe(false);
  });

  it("should do nothing if markdown contains no valid blocks", async () => {
    const mdContent = `
This is a regular markdown file.
No code blocks with file paths here.
    `;
    createMarkdownFile(mdContent);
    const initialFiles = fs.readdirSync(tempDir);

    await applyAiResponse(mdFilePath, {yes: true, cwd: tempDir});

    const finalFiles = fs.readdirSync(tempDir);
    expect(finalFiles).toEqual(initialFiles); // No files should be added or removed.
  });

  it("should correctly identify an unsafe file path", async () => {
    const mdContent = `
#### \`../unsafe-file.txt\`
\`\`\`
This should be marked as unsafe.
\`\`\`
    `;
    createMarkdownFile(mdContent);
    {
      const filesToUpdate = await applyAiResponse(mdFilePath, {yes: true, cwd: tempDir});

      expect(filesToUpdate).toHaveLength(0);
    }
    {
      const filesToUpdate = await applyAiResponse(mdFilePath, {yes: true, cwd: tempDir, unsafe: true});

      expect(filesToUpdate).toHaveLength(1);
      const unsafeFile = filesToUpdate?.[0];
      expect(unsafeFile?.filePath).toBe("../unsafe-file.txt");
      expect(unsafeFile?.safe).toBe(false);

      // Also assert the file was not created outside the temp directory boundary
      const unsafePath = path.resolve(tempDir, "..", "unsafe-file.txt");
      expect(fs.existsSync(unsafePath)).toBe(true);
    }
  });
});
