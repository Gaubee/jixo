import type {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {ServerNotification, ServerRequest} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import * as server from "../server.js";
import {state} from "../state.js";
import {readwritePermissions} from "../types.js";

export const SANDBOX = path.resolve("./mcp-fs-test-sandbox");

export function setupSandbox() {
  fs.rmSync(SANDBOX, {recursive: true, force: true});
  fs.mkdirSync(SANDBOX, {recursive: true});
  state.mountPoints = [{realPath: SANDBOX, permissions: readwritePermissions, rawPath: SANDBOX}];
  state.cwd = SANDBOX;
}

export function cleanupSandbox() {
  fs.rmSync(SANDBOX, {recursive: true, force: true});
  state.mountPoints = [];
  state.cwd = "";
}

type Tools = typeof server.readwriteTools;
type ToolName = keyof Tools;
type ToolDefinition = Tools[ToolName];

// This is the key fix. We explicitly infer the 'args' type from the tool's callback
// and define our handler to take exactly that type. This resolves all argument-related
// compilation errors in the test files.
type ToolHandler<T extends ToolDefinition> = T["callback"] extends (args: infer A, extra: any) => infer R ? (args: A) => R : never;

export function getToolHandler<T extends ToolName>(toolName: T): ToolHandler<Tools[T]> {
  const tool = server.readwriteTools[toolName];
  if (!tool) throw new Error(`Tool definition for "${toolName}" not found.`);

  return ((args: any) => tool.callback(args, {} as RequestHandlerExtra<ServerRequest, ServerNotification>)) as any;
}
