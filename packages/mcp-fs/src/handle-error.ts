import {returnError, type McpToolError} from "@jixo/mcp-core";

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

  // Construct a plain object that strictly adheres to the genericErrorRawShape.
  // This prevents extra properties like 'stack' from causing schema validation failures.
  const errorPayload = {
    name: errorObj.name,
    message: errorObj.message,
    remedy_tool_suggestions: (errorObj as McpToolError).remedy_tool_suggestions,
  };

  return returnError(`Error in tool '${toolName}': ${errorObj.message}`, errorPayload);
};
