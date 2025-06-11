import fs from "fs/promises";
import assert from "node:assert";
import {after, beforeEach, describe, mock, test} from "node:test";
import {pnpmApi} from "../index.js";

// --- Mock Setup ---
// The mock now captures an array of arguments, reflecting the safer `spawn` approach.
let lastCall: {args: string[] | null; cwd: string | undefined} = {args: null, cwd: undefined};

// Mock pnpmApi.executePnpmCommand to capture the args array and cwd.
mock.method(pnpmApi, "executePnpmCommand", async (args: string[], cwd?: string) => {
  lastCall = {args, cwd};
  // The return value can be simple, as we're testing the inputs to this function.
  return `Mock execution of: pnpm ${args.join(" ")} in ${cwd || "default CWD"}`;
});

// Mock fs.readFile remains the same for the 'run' tool security check.
mock.method(fs, "readFile", async (path: string) => {
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
    lastCall = {args: null, cwd: undefined};
  });

  describe("`install` tool", () => {
    test("should run basic install in default CWD", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({});
      assert.deepStrictEqual(lastCall.args, ["install"]);
      assert.strictEqual(lastCall.cwd, undefined);
    });

    test("should run install in a specified CWD", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({cwd: "./packages/app"});
      assert.deepStrictEqual(lastCall.args, ["install"]);
      assert.strictEqual(lastCall.cwd, "./packages/app");
    });

    test("should handle --frozen-lockfile and --prod flags", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({frozenLockfile: true, production: true});
      assert.deepStrictEqual(lastCall.args, ["install", "--frozen-lockfile", "--prod"]);
    });

    test("should include extraArgs", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({extraArgs: ["--reporter=json", "--no-optional"]});
      assert.deepStrictEqual(lastCall.args, ["install", "--reporter=json", "--no-optional"]);
    });

    test("should combine all options correctly", async () => {
      const installHandler = getToolHandler("install");
      await installHandler({
        cwd: "./backend",
        production: true,
        extraArgs: ["--ignore-scripts"],
      });
      assert.deepStrictEqual(lastCall.args, ["install", "--prod", "--ignore-scripts"]);
      assert.strictEqual(lastCall.cwd, "./backend");
    });
  });

  describe("`add` tool", () => {
    test("should add a package in a specified CWD", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({packages: ["zod"], cwd: "./common/utils"});
      assert.deepStrictEqual(lastCall.args, ["add", "zod"]);
      assert.strictEqual(lastCall.cwd, "./common/utils");
    });

    test("should handle dev, optional, and filter flags", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({
        packages: ["eslint"],
        dev: true,
        optional: true,
        filter: "my-app",
      });
      // Order of flags doesn't matter, but the array contents do.
      assert.deepStrictEqual(lastCall.args, ["--filter", "my-app", "add", "-D", "-O", "eslint"]);
    });

    test("should combine packages and extraArgs", async () => {
      const addHandler = getToolHandler("add");
      await addHandler({
        packages: ["dayjs"],
        extraArgs: ["--save-exact"],
      });
      assert.deepStrictEqual(lastCall.args, ["add", "dayjs", "--save-exact"]);
    });
  });

  describe("`run` tool", () => {
    test("should run a script in a specified CWD", async () => {
      const runHandler = getToolHandler("run");
      await runHandler({script: "build", cwd: "./services/api"});
      assert.deepStrictEqual(lastCall.args, ["run", "build"]);
      assert.strictEqual(lastCall.cwd, "./services/api");
    });

    test("should combine script args and extraArgs", async () => {
      const runHandler = getToolHandler("run");
      await runHandler({
        script: "test",
        scriptArgs: ["--ci", "--coverage"],
        extraArgs: ["--stream"],
      });
      // Note the "--" separator
      assert.deepStrictEqual(lastCall.args, ["run", "test", "--stream", "--", "--ci", "--coverage"]);
    });
  });

  // **IMPORTANT**: The schema for `dlx` and `create` was changed for security.
  // The tests must be updated to reflect this.
  describe("`dlx` tool", () => {
    test("should run dlx with command and args as an array", async () => {
      const dlxHandler = getToolHandler("dlx");
      await dlxHandler({
        commandAndArgs: ["cowsay", "Hello MCP!"],
        extraArgs: ["--quiet"],
        cwd: "/tmp/test",
      });
      assert.deepStrictEqual(lastCall.args, ["dlx", "--quiet", "cowsay", "Hello MCP!"]);
      assert.strictEqual(lastCall.cwd, "/tmp/test");
    });
  });

  describe("`create` tool", () => {
    test("should run create with template and its args", async () => {
      const createHandler = getToolHandler("create");
      await createHandler({
        template: "vite",
        templateArgs: ["my-new-app", "--template", "react-ts"],
        cwd: "./projects",
      });
      assert.deepStrictEqual(lastCall.args, ["create", "vite", "my-new-app", "--template", "react-ts"]);
      assert.strictEqual(lastCall.cwd, "./projects");
    });
  });

  describe("`licenses` tool", () => {
    test("should list licenses with dev and production flags", async () => {
      const licensesHandler = getToolHandler("licenses");
      await licensesHandler({dev: true, production: true});
      assert.deepStrictEqual(lastCall.args, ["licenses", "list", "--dev", "--prod"]);
    });

    test("should combine all options in a specified CWD", async () => {
      const licensesHandler = getToolHandler("licenses");
      await licensesHandler({
        json: true,
        dev: true,
        extraArgs: ["--long"],
        cwd: "./frontend",
      });
      assert.deepStrictEqual(lastCall.args, ["licenses", "list", "--json", "--dev", "--long"]);
      assert.strictEqual(lastCall.cwd, "./frontend");
    });
  });
});
