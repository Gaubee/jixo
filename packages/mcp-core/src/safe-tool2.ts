import {type McpServer, type RegisteredTool, type ToolCallback} from "@modelcontextprotocol/sdk/server/mcp.js";
import type {RequestHandlerExtra} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {CallToolResult, ServerNotification, ServerRequest} from "@modelcontextprotocol/sdk/types.js";
import type {ZodBoolean, ZodLiteral, ZodObject, ZodOptional, ZodRawShape, ZodUnion} from "zod/v3";
import z from "zod/v3";
import {genericErrorRawShape} from "./schemas.js";

type PromiseMaybe<T> = Promise<T> | T;

export type SuccessRawShape<T extends ZodRawShape = ZodRawShape> = {
  success: ZodLiteral<true>;
  result: ZodObject<T>;
};
// export type SuccessRawShape<T extends ZodRawShape = ZodRawShape> = {
//   success: ZodLiteral<true>;
// } & T;
export type SuccessData<T extends ZodRawShape = ZodRawShape> = ZodObject<SuccessRawShape<T>>;
export type ErrorRawShape<T extends ZodRawShape = ZodRawShape> = {
  success: ZodLiteral<false>;
  error: ZodObject<T>;
};
export type ErrorData<T extends ZodRawShape = ZodRawShape> = ZodObject<ErrorRawShape<T>>;

const unsafeOutputSchema = <TSuccess extends ZodRawShape, TError extends ZodRawShape>(success: TSuccess, error: TError): UnsafeOutputSchema<TSuccess, TError> => {
  return z.object({
    success: z.boolean(),
    error: z.object(error).optional(),
    result: z.object(success).optional(),
    // ...success,
  });
};

// export type UnsafeOutputRawShape<TSuccess extends ZodRawShape, TError extends ZodRawShape> = UnsafeOutputSchema<TSuccess, TError>["shape"];
// export type UnsafeOutputSchema<TSuccess extends ZodRawShape, TError extends ZodRawShape> = ReturnType<typeof unsafeOutputSchema<TSuccess, TError>>;

export type UnsafeOutputRawShape<TSuccess extends ZodRawShape, TError extends ZodRawShape> = {
  success: ZodBoolean;
  result: ZodOptional<ZodObject<TSuccess>>;
  error: ZodOptional<ZodObject<TError>>;
}; //& TSuccess;
export type UnsafeOutputSchema<TSuccess extends ZodRawShape, TError extends ZodRawShape> = ZodObject<UnsafeOutputRawShape<TSuccess, TError>>;

export type UnsafeOutputData<TSuccess extends ZodRawShape, TError extends ZodRawShape> = z.output<UnsafeOutputSchema<TSuccess, TError>>;

const successShape = <TSuccess extends ZodRawShape>(success: TSuccess) => {
  return z.object({
    success: z.literal(true),
    // ...success,
    result: z.object(success),
  });
};
const errorShape = <TError extends ZodRawShape>(error: TError) => {
  return z.object({
    success: z.literal(false),
    error: z.object(error),
  });
};
const safeOutputSchema = <TSuccess extends ZodRawShape, TError extends ZodRawShape>(success: TSuccess, error: TError): SafeOutputSchema<TSuccess, TError> => {
  return z.union([successShape(success), errorShape(error)]);
};
// export type SafeOutputSchema<TSuccess extends ZodRawShape, TError extends ZodRawShape> = ReturnType<typeof safeOutputSchema<TSuccess, TError>>;
export type SafeOutputSchema<TSuccess extends ZodRawShape, TError extends ZodRawShape> = ZodUnion<[SuccessData<TSuccess>, ErrorData<TError>]>;

export type SafeOutputData<TSuccess extends ZodRawShape, TError extends ZodRawShape> = z.output<SafeOutputSchema<TSuccess, TError>>;

/**
 * A strongly-typed tool callback for safeRegisterTool2.
 * The return type leverages a ZodUnion to enable discriminated union type inference
 * based on the `success` literal flag.
 */
export type SafeToolCallback2<TInput extends ZodRawShape, TSuccess extends ZodRawShape, TError extends ZodRawShape> = (
  args: z.output<z.ZodObject<TInput>>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => PromiseMaybe<
  CallToolResult & {
    structuredContent: SafeOutputData<TSuccess, TError>;
  }
>;

/**
 * An advanced, type-safe wrapper for `server.registerTool` that provides
 * superior type inference for success and error states using discriminated unions.
 *
 * @param server The McpServer instance.
 * @param name The name of the tool.
 * @param config Configuration object containing input and separate success/error output schemas.
 * @param callback The type-safe tool callback.
 * @returns A strongly-typed object representing the registered tool.
 */
function safeRegisterTool<TInput extends ZodRawShape, TSuccess extends ZodRawShape, TError extends ZodRawShape = typeof genericErrorRawShape>(
  server: McpServer,
  name: string,
  config: {
    description?: string;
    inputSchema: TInput;
    outputSuccessSchema: TSuccess;
    outputErrorSchema?: TError;
  },
  callback: SafeToolCallback2<TInput, TSuccess, TError>,
): {
  underlying: RegisteredTool;
  inputSchema: ZodObject<TInput>;
  outputSchema: UnsafeOutputSchema<TSuccess, TError>;
  outputUnion: SafeOutputSchema<TSuccess, TError>;
  callback: SafeToolCallback2<TInput, TSuccess, TError>;
} {
  const {outputSuccessSchema: successRawShape, outputErrorSchema: errorRawShape = genericErrorRawShape as unknown as TError} = config;
  const combinedOutputSchema = unsafeOutputSchema(successRawShape, errorRawShape);
  const unionOutputSchema = safeOutputSchema(successRawShape, errorRawShape);

  const underlying = server.registerTool(
    name,
    {
      description: config.description,
      inputSchema: config.inputSchema,
      outputSchema: combinedOutputSchema.shape,
    },
    callback as unknown as ToolCallback<TInput>,
  );

  return {
    underlying,
    inputSchema: z.object(config.inputSchema ?? ({} as TInput)),
    outputSchema: combinedOutputSchema,
    outputUnion: unionOutputSchema,
    callback,
  };
}

export const returnSuccess = <T>(message: string, successContent: T) => {
  return {
    structuredContent: {success: true as const, result: successContent},
    content: [{type: "text" as const, text: message}],
  };
};

export const returnError = <T>(message: string, errorContent: T) => {
  return Object.assign(
    {
      isError: true as const,
      content: [{type: "text" as const, text: message}],
    } as CallToolResult,
    {
      structuredContent: {success: false as const, error: errorContent},
    },
  );
};

export const safeRegisterTool2 = Object.assign(safeRegisterTool, {returnSuccess, returnError});
