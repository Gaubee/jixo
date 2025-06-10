import fs from "fs/promises";
import assert from "node:assert";
import {after, beforeEach, describe, mock, test} from "node:test";
import {pnpmApi} from "../index.js";

// --- Mock Setup ---
let lastCall: {command: string | null; cwd: string | undefined} = {command: null, cwd: undefined};

// Mock pnpmApi.executePnpmCommand to capture both command and cwd
mock.method(pnpmApi, "executePnpmCommand", async (command: string, cwd?: string) => {
  lastCall = {command, cwd};
  return `Mock execution of: pnpm ${command} in ${cwd || "default CWD"}`;
});

// Mock fs.readFile to handle different CWDs for the 'run' tool security check
mock.method(fs, "readFile", async (path: string) => {
  // We check for the specific package.json path that the 'run' handler constructs.
  if (path.endsWith("package.json")) {
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

after(() => {
  mock.restoreAll();
});
// --- End Mock Setup ---

function getToolHandler(toolName: string) {
  const handler = pnpmApi.tools[toolName]?.callback;
  if (!handler) {
    throw new Error(`Tool callback for "${toolName}" not found.`);
  }
  // @ts-ignore - The 'extra' parameter is not needed for our tests.
  return (args: any) => handler(args, {} as any);
}

describe("MCP pnpm Tool Command Generation (with CWD and extraArgs)", () => {
  beforeEach(() => {
    lastCall = {command: null, cwd: undefined};
  });

  describe("`install` tool", () => {
    test("should run basic install in default CWD", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({});
      assert.strictEqual(lastCall.command, "install");
      assert.strictEqual(lastCall.cwd, undefined);
    });

    test("should run install in a specified CWD", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({cwd: "./packages/app"});
      assert.strictEqual(lastCall.command, "install");
      assert.strictEqual(lastCall.cwd, "./packages/app");
    });

    test("should handle --frozen-lockfile and --prod flags", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({frozenLockfile: true, production: true});
      assert.strictEqual(lastCall.command, "install --frozen-lockfile --prod");
    });

    test("should include extraArgs", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({extraArgs: ["--reporter=json", "--no-optional"]});
      assert.strictEqual(lastCall.command, "install --reporter=json --no-optional");
    });

    test("should combine all options correctly", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({
        cwd: "./backend",
        production: true,
        extraArgs: ["--ignore-scripts"],
      });
      assert.strictEqual(lastCall.command, "install --prod --ignore-scripts");
      assert.strictEqual(lastCall.cwd, "./backend");
    });
  });

  describe("`add` tool", () => {
    test("should add a package in a specified CWD", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({packages: ["zod"], cwd: "./common/utils"});
      assert.strictEqual(lastCall.command, "add zod");
      assert.strictEqual(lastCall.cwd, "./common/utils");
    });

    test("should handle dev, optional, and filter flags", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({
        packages: ["eslint"],
        dev: true,
        optional: true, // Though mutually exclusive in reality, we test concatenation
        filter: "my-app",
      });
      assert.strictEqual(lastCall.command, "--filter my-app add -D -O eslint");
    });

    test("should combine packages and extraArgs", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({
        packages: ["dayjs"],
        extraArgs: ["--save-exact"],
      });
      assert.strictEqual(lastCall.command, "add dayjs --save-exact");
    });
  });

  describe("`run` tool", () => {
    test("should run a script in a specified CWD", async () => {
      const runHandler = getToolHandler("run");
      await runHandler({script: "build", cwd: "./services/api"});
      assert.strictEqual(lastCall.command, "run build");
      assert.strictEqual(lastCall.cwd, "./services/api");
    });

    test("should combine script args and extraArgs", async () => {
      const runHandler = getToolHandler("run");
      await runHandler({
        script: "test",
        args: ["--ci"],
        extraArgs: ["--stream"],
      });
      assert.strictEqual(lastCall.command, "run test -- --ci --stream");
    });
  });

  describe("`dlx` tool", () => {
    test("should run dlx with extraArgs in a specified CWD", async () => {
      const dlxHandler = getToolHandler("dlx");
      await dlxHandler({
        command: "cowsay",
        extraArgs: ['"Hello MCP!"'],
        cwd: "/tmp/test",
      });
      assert.strictEqual(lastCall.command, 'dlx cowsay "Hello MCP!"');
      assert.strictEqual(lastCall.cwd, "/tmp/test");
    });
  });

  describe("`create` tool", () => {
    test("should run create with extraArgs for project name and template", async () => {
      const createHandler = getToolHandler("create");
      await createHandler({
        template: "vite",
        extraArgs: ["my-new-app", "--template", "react-ts"],
        cwd: "./projects",
      });
      assert.strictEqual(lastCall.command, "create vite my-new-app --template react-ts");
      assert.strictEqual(lastCall.cwd, "./projects");
    });
  });

  describe("`licenses` tool", () => {
    test("should list licenses with dev and production flags", async () => {
      const licensesHandler = getToolHandler("licenses");
      await licensesHandler({dev: true, production: true});
      assert.strictEqual(lastCall.command, "licenses list --dev --prod");
    });

    test("should combine all options in a specified CWD", async () => {
      const licensesHandler = getToolHandler("licenses");
      await licensesHandler({
        json: true,
        dev: true,
        extraArgs: ["--long"],
        cwd: "./frontend",
      });
      assert.strictEqual(lastCall.command, "licenses list --json --dev --long");
      assert.strictEqual(lastCall.cwd, "./frontend");
    });
  });
});
