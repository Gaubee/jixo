import {returnError} from "@jixo/mcp-core";

/**
 * Centralized error handler for all tools.
 * It formats the error message and provides specific suggestions for certain error types,
 * returning a structured response that conforms to the tool's output schema.
 * @param toolName The name of the tool that failed.
 * @param error The caught error object.
 * @returns A structured error object for the MCP client.
 */
export const handleToolError = (toolName: string, error: unknown) => {
  const errorObj = error instanceof Error ? error : new Error(String(error), {cause: error});
  if (!errorObj.name || errorObj.name === "Error") {
    errorObj.name = error?.constructor?.name ?? "UnknownError";
  }

  console.error(`[ERROR in ${toolName}] ${errorObj.message}`);
  return returnError(`Error in tool '${toolName}': ${errorObj.message}`, errorObj);
};
