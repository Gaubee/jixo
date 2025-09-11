import {type McpServer, type RegisteredTool, type ToolCallback} from "@modelcontextprotocol/sdk/server/mcp.js";
import type {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {CallToolResult, ServerNotification, ServerRequest} from "@modelcontextprotocol/sdk/types.js";
import z from "zod/v3";

type PromiseMaybe<T> = Promise<T> | T;
type SafeToolCallback<Args extends z.ZodRawShape, Output extends z.ZodRawShape> = (
  args: z.output<z.ZodObject<Args>>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => PromiseMaybe<CallToolResult & {structuredContent: z.output<z.ZodObject<Output>>}>;

/**
 * A type-safe wrapper for `server.registerTool`.
 * It captures the specific Zod shapes for input and output, returning a strongly-typed object
 * that preserves this metadata, unlike the generic `RegisteredTool` from the SDK.
 */
export function safeRegisterTool<I extends z.ZodRawShape, O extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: {
    description?: string;
    inputSchema: I;
    outputSchema: O;
  },
  callback: SafeToolCallback<I, O>,
): {
  underlying: RegisteredTool;
  inputSchema: z.ZodObject<I>;
  outputSchema: z.ZodObject<O>;
  callback: SafeToolCallback<I, O>;
} {
  // The SDK's registerTool does the actual registration.
  const underlying = (server as any).registerTool(name, config, callback);// callback as ToolCallback<I>
  // We return a new object that includes the typed schemas for compile-time safety.
  return {
    underlying,
    inputSchema: z.object(config.inputSchema ?? ({} as I)),
    outputSchema: z.object(config.outputSchema ?? ({} as O)),
    callback,
  };
}
