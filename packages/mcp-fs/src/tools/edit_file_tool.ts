import {logger, returnSuccess} from "@jixo/mcp-core";
import {createTwoFilesPatch} from "diff";
import fs from "node:fs";
import {applyFileEdits} from "../fs-utils/apply-edits.js";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {registerTool} from "./server.js";

export const edit_file_tool = registerTool(
  "readwrite",
  "edit_file",
  {
    description: `
Performs one or more precise, atomic search-and-replace operations on a single text file. This is the preferred tool for modifying code or configuration.

**AI Decision Guidance**:
- Use this tool for targeted changes like refactoring a variable name, updating a dependency version, or adding a new configuration key.
- For creating a new file from scratch or completely replacing its content, use 'write_file'.
- **Conflict Avoidance**: This tool is designed to prevent accidental data loss. If the 'oldText' for any edit is not found, the entire operation will fail. This indicates the file's current content doesn't match what you expect. In this case, you should first use 'read_file' to get the latest content, then construct a new, valid edit operation.

**Usage Notes**:
- **Edits**: The 'edits' parameter is an array, allowing multiple independent changes in a single, atomic transaction.
- **Return Style**: The 'returnStyle' parameter controls what you get back after a successful edit:
    - 'diff' (default): Returns a git-style diff, best for verification.
    - 'full': Returns the entire new content of the file.
    - 'none': Returns only a success message, useful for fire-and-forget operations.
    `,
    inputSchema: s.EditFileArgsSchema,
    outputSuccessSchema: s.EditFileOutputSuccessSchema,
  },
  async ({path, edits, dryRun, returnStyle = "diff"}) => {
    try {
      const validPath = validatePath(path);
      const {originalContent, modifiedContent} = applyFileEdits(validPath, edits);
      const changesApplied = originalContent !== modifiedContent;
      let diff: string | null = null;
      let statusMessage: string;

      if (!changesApplied) {
        statusMessage = `No changes were made to the file '${validPath}'; content is identical.`;
      } else {
        if (!dryRun) {
          fs.writeFileSync(validPath, modifiedContent, "utf-8");
        }
        statusMessage = dryRun ? `Dry run successful. Proposed changes for ${validPath}:` : `Successfully applied edits to ${validPath}.`;
        diff = createTwoFilesPatch(validPath, validPath, originalContent, modifiedContent, "", "", {context: 3});
      }

      let responseText = "";
      if (changesApplied && returnStyle !== "none") {
        if (returnStyle === "full") {
          responseText = modifiedContent;
        } else if (returnStyle === "diff" && diff) {
          responseText = `\`\`\`diff\n${diff}\n\`\`\``;
        }
      }

      const finalMessage = responseText ? `${statusMessage}\n${responseText}` : statusMessage;

      logger.log("edit_file", finalMessage);

      return {
        ...returnSuccess(finalMessage, {
          path: validPath,
          changesApplied,
          diff,
          newContent: returnStyle === "full" ? modifiedContent : null,
          message: statusMessage,
        }),
        content: [{type: "text", text: finalMessage}],
      };
    } catch (error) {
      return handleToolError("edit_file", error);
    }
  },
);
