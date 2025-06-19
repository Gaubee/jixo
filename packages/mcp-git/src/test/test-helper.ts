import type {Func} from "@gaubee/util";
import type {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {ServerNotification, ServerRequest} from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {simpleGit} from "simple-git";
import {GitWrapper} from "../git-wrapper.js";
import * as server from "../server.js";

const BASE_SANDBOX = path.join(os.tmpdir(), "mcp-git-test-sandboxes");

export function setupSandbox() {
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const sandboxPath = path.join(BASE_SANDBOX, `sandbox-${randomSuffix}`);

  fs.mkdirSync(sandboxPath, {recursive: true});

  return {
    sandboxPath,
    git: simpleGit(sandboxPath),
    initRepo: async () => {
      await GitWrapper.init(sandboxPath);
      return {
        repoPath: sandboxPath,
        git: simpleGit(sandboxPath),
      };
    },
  };
}

export function cleanupSandbox(sandboxPath: string) {
  if (fs.existsSync(sandboxPath)) {
    fs.rmSync(sandboxPath, {recursive: true, force: true});
  }
}
type Tools = typeof server.tools;
type ToolName = keyof Tools;
type SafeCallback<T extends ToolName> = (typeof server.tools)[T]["callback"];
type ToolHandler<T extends ToolName> = (args: Func.Args<SafeCallback<T>>[0]) => ReturnType<SafeCallback<T>>;
export function getToolHandler<T extends ToolName>(toolName: T) {
  const tool = server.tools[toolName];
  if (!tool) throw new Error(`Tool definition for "${toolName}" not found.`);

  return ((args: any) => tool.callback(args, {} as RequestHandlerExtra<ServerRequest, ServerNotification>)) as any as ToolHandler<T>;
}
