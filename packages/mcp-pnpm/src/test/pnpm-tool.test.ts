import assert from "node:assert";
import fs from "node:fs/promises"; // 导入 fs/promises 以便 mock
import {after, beforeEach, describe, mock, test} from "node:test";
import {pnpmApi} from "../index.js"; // 导入我们创建的 API 对象

// --- Mock Setup ---
let executedCommand: string | null = null;

// Mock pnpmApi.executePnpmCommand
mock.method(pnpmApi, "executePnpmCommand", async (command: string) => {
  executedCommand = command;
  return `Mock execution of: pnpm ${command}`;
});
// ✅ Mock fs.readFile
mock.method(fs, "readFile", async (path: string) => {
  if (path === "package.json") {
    // 返回一个包含测试所需脚本的伪造 package.json 内容
    return JSON.stringify({
      name: "test-project",
      version: "1.0.0",
      scripts: {
        build: 'echo "building..."',
        lint: 'echo "linting..."',
        test: 'echo "testing..."',
      },
    });
  }
  throw new Error(`readFile mock: unhandled path ${path}`);
});

// 在所有测试结束后，恢复所有 mock
after(() => {
  mock.restoreAll();
});
// --- End Mock Setup ---

function getToolHandler(toolName: string) {
  const handler = pnpmApi.tools[toolName]?.callback;
  if (!handler) {
    throw new Error(`Tool callback for "${toolName}" not found.`);
  }
  return (args: any) => handler(args, {} as any);
}

describe("MCP pnpm Tool Command Generation", () => {
  // 在每个测试用例运行之前，重置状态
  beforeEach(() => {
    executedCommand = null;
  });

  // ... 所有测试用例 (test 和 describe 块) 保持不变 ...
  // ... 从 "test('`install` tool...')" 开始的所有内容都无需修改 ...

  test('`install` tool should generate "pnpm install"', async () => {
    const installHandler = getToolHandler("install");
    await installHandler({});
    assert.strictEqual(executedCommand, "install");
  });

  describe("`add` tool", () => {
    test("should handle a single package", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({packages: ["react"]});
      assert.strictEqual(executedCommand, "add react");
    });

    test("should handle multiple packages", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({packages: ["react", "typescript"]});
      assert.strictEqual(executedCommand, "add react typescript");
    });

    test("should handle a dev dependency", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({packages: ["vitest"], dev: true});
      assert.strictEqual(executedCommand, "add -D vitest");
    });

    test("should handle a JSR package", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({packages: ["jsr:@luca/cases"]});
      assert.strictEqual(executedCommand, "add jsr:@luca/cases");
    });

    test("should handle a workspace filter", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({packages: ["lodash"], filter: "my-app"});
      assert.strictEqual(executedCommand, "--filter my-app add lodash");
    });

    test("should handle a filter and dev flag together", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({packages: ["eslint"], dev: true, filter: "my-lib"});
      assert.strictEqual(executedCommand, "--filter my-lib add -D eslint");
    });
  });

  describe("`run` tool", () => {
    test("should run a simple script", async () => {
      const runHandler = getToolHandler("run");
      await runHandler({script: "build"});
      assert.strictEqual(executedCommand, "run build");
    });

    test("should run a script with arguments", async () => {
      const runHandler = getToolHandler("run");
      await runHandler({script: "test", args: ["--watch", "my-component.test.ts"]});
      assert.strictEqual(executedCommand, "run test -- --watch my-component.test.ts");
    });

    test("should run a script with a filter", async () => {
      const runHandler = getToolHandler("run");
      await runHandler({script: "lint", filter: "frontend"});
      assert.strictEqual(executedCommand, "--filter frontend run lint");
    });
  });

  describe("`dlx` tool", () => {
    test("should execute a simple command", async () => {
      const dlxHandler = getToolHandler("dlx");
      await dlxHandler({command: "cowsay"});
      assert.strictEqual(executedCommand, "dlx cowsay");
    });

    test("should execute a command with a version and arguments", async () => {
      const dlxHandler = getToolHandler("dlx");
      await dlxHandler({command: "create-vite@latest", args: ["my-app", "--template", "react-ts"]});
      assert.strictEqual(executedCommand, "dlx create-vite@latest my-app --template react-ts");
    });
  });

  describe("`create` tool", () => {
    test("should generate a simple create command", async () => {
      const createHandler = getToolHandler("create");
      await createHandler({template: "vite"});
      assert.strictEqual(executedCommand, "create vite");
    });

    test("should generate create command with arguments", async () => {
      const createHandler = getToolHandler("create");
      await createHandler({template: "vite", args: ["my-app", "--", "--template", "react"]});
      assert.strictEqual(executedCommand, "create vite my-app -- --template react");
    });
  });

  describe("`licenses` tool", () => {
    test("should generate the base command", async () => {
      const licensesHandler = getToolHandler("licenses");
      await licensesHandler({});
      assert.strictEqual(executedCommand, "licenses list");
    });

    test("should add the --json flag", async () => {
      const licensesHandler = getToolHandler("licenses");
      await licensesHandler({json: true});
      assert.strictEqual(executedCommand, "licenses list --json");
    });
  });
});
