import type {Func} from "@gaubee/util";
import type {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {ServerNotification, ServerRequest} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import * as server from "../server.js";

export const SANDBOX = path.resolve("./mcp-fs-test-sandbox");

export function setupSandbox() {
  fs.rmSync(SANDBOX, {recursive: true, force: true});
  fs.mkdirSync(SANDBOX, {recursive: true});
}

export function cleanupSandbox() {
  fs.rmSync(SANDBOX, {recursive: true, force: true});
}

type Tools = typeof server.tools;
type ToolName = keyof Tools;
type ToolDefinition = Tools[ToolName];
type ToolCallback<T extends ToolDefinition> = T["callback"];
type ToolHandler<T extends ToolDefinition> = (args: Func.Args<ToolCallback<T>>[0]) => ReturnType<ToolCallback<T>>;

export function getToolHandler<T extends ToolName>(toolName: T): ToolHandler<Tools[T]> {
  const tool = server.tools[toolName];
  if (!tool) throw new Error(`Tool definition for "${toolName}" not found.`);

  return ((args: any) => tool.callback(args, {} as RequestHandlerExtra<ServerRequest, ServerNotification>)) as any;
}
