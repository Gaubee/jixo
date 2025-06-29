import type {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {ServerNotification, ServerRequest} from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {afterAll, afterEach, beforeAll, beforeEach, describe} from "vitest";
import * as server from "../server.js";
import {state} from "../state.js";
import {readwritePermissions} from "../types.js";

type Tools = typeof server.readwriteTools;
type ToolName = keyof Tools;
type ToolDefinition = Tools[ToolName];
type ToolHandler<T extends ToolDefinition> = T["callback"] extends (args: infer A, extra: any) => infer R ? (args: A) => R : never;

export function getToolHandler<T extends ToolName>(toolName: T): ToolHandler<Tools[T]> {
  const tool = server.readwriteTools[toolName];
  if (!tool) throw new Error(`Tool definition for "${toolName}" not found.`);
  return ((args: any) => tool.callback(args, {} as RequestHandlerExtra<ServerRequest, ServerNotification>)) as any;
}

interface TestContext {
  sandboxPath: string;
  getTool<T extends ToolName>(toolName: T): ToolHandler<Tools[T]>;
}

/**
 * Creates a fully isolated test suite with its own sandbox directory.
 * @param suiteName The name of the test suite.
 * @param suiteDefinition A function that defines the tests within the suite.
 */
export function createIsolatedTestSuite(suiteName: string, suiteDefinition: (context: TestContext) => void) {
  describe(suiteName, () => {
    const sandboxPath = path.resolve("./mcp-fs-test-sandbox", crypto.randomUUID());
    const context: TestContext = {
      sandboxPath,
      getTool: getToolHandler,
    };

    beforeAll(() => {
      fs.mkdirSync(sandboxPath, {recursive: true});
    });

    afterAll(() => {
      fs.rmSync(sandboxPath, {recursive: true, force: true});
    });

    beforeEach(() => {
      // Set up the state for this isolated environment
      state.mountPoints = [{drive: "A", realPath: sandboxPath, permissions: readwritePermissions, rawPath: sandboxPath}];
      state.cwd = sandboxPath;
    });

    afterEach(() => {
      // Clear state after each test
      state.mountPoints = [];
      state.cwd = "";
      // Clean the content inside sandbox, but not the sandbox dir itself
      const entries = fs.readdirSync(sandboxPath);
      for (const entry of entries) {
        fs.rmSync(path.join(sandboxPath, entry), {recursive: true, force: true});
      }
    });

    suiteDefinition(context);
  });
}
