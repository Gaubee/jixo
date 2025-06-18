import type {CallToolResult} from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {simpleGit} from "simple-git";
import {z} from "zod";
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

export function getToolHandler<T extends keyof typeof server.tools>(toolName: T) {
  const tool = server.tools[toolName];
  if (!tool) throw new Error(`Tool definition for "${toolName}" not found.`);
  // @ts-ignore
  return (args: z.infer<typeof tool.inputSchema>): Promise<CallToolResult> => tool.callback(args, {} as any);
}
