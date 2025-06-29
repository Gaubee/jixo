import {logger, returnSuccess} from "@jixo/mcp-core";
import fs from "node:fs";
import {NotADirectoryError} from "../error.js";
import {resolveAndValidatePath} from "../fs-utils/resolve-and-validate-path.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const create_directory_tool = registerTool(
  "readwrite",
  "create_directory",
  {
    description: `
Creates a new directory. It will also create any necessary parent directories along the path.

**AI DECISION GUIDANCE**:
- Use this to set up the folder structure for a new project or component.
- This tool is idempotent: if the directory already exists, the operation will succeed without making any changes.

**USAGE PATTERNS**:
- \`create_directory({ path: './new-component/src' })\`
- \`create_directory({ path: '$A/assets/images' })\`
    `,
    inputSchema: s.CreateDirectoryArgsSchema,
    outputSuccessSchema: s.CreateDirectorySuccessSchema,
  },
  async ({path}) => {
    try {
      const {validatedPath} = resolveAndValidatePath(path, "write");
      fs.mkdirSync(validatedPath, {recursive: true});
      const message = `Successfully created directory ${validatedPath}`;
      logger.error("[SUCCESS]", "create_directory", message);
      return returnSuccess(message, {path: validatedPath, message});
    } catch (error: any) {
      if (error.code === "ENOTDIR") {
        return handleToolError("create_directory", new NotADirectoryError(`A component of the path '${path}' is a file, not a directory.`));
      }
      logger.error("[ERROR]", "create_directory", error);
      return handleToolError("create_directory", error);
    }
  },
);
