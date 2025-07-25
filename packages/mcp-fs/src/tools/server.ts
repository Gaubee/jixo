import {type SafeToolCallback2, genericErrorRawShape, safeRegisterTool2} from "@jixo/mcp-core";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import type {ZodRawShape} from "zod/v3";
import pkg from "../../package.json" with {type: "json"};

export const readOnlyServer = new McpServer({
  name: "secure-readonly-filesystem-server",
  version: pkg.version,
});

export const readWriteServer = new McpServer({
  name: "secure-readwrite-filesystem-server",
  version: pkg.version,
});

/**
 * Registers a tool on the appropriate server instance(s) based on its mode.
 * 'readonly' tools are available on both servers.
 * 'readwrite' tools are only available on the read-write server.
 */
export function registerTool<TInput extends ZodRawShape, TSuccess extends ZodRawShape, TError extends ZodRawShape = typeof genericErrorRawShape>(
  mode: "readonly" | "readwrite",
  name: string,
  config: {
    description?: string;
    inputSchema: TInput;
    outputSuccessSchema: TSuccess;
    outputErrorSchema?: TError;
  },
  callback: SafeToolCallback2<TInput, TSuccess, TError>,
) {
  if (mode === "readonly") {
    // A read-only server only gets the read-only tools.
    safeRegisterTool2(readOnlyServer, name, config, callback);
  }

  // A read-write server should have all tools.
  return safeRegisterTool2(readWriteServer, name, config, callback);
}
