import {logger, returnSuccess, safeRegisterTool2} from "@jixo/mcp-core";
import {createTwoFilesPatch} from "diff";
import fs from "node:fs";
import {applyFileEdits} from "../fs-utils/apply-edits.js";
import {validatePath} from "../fs-utils/path-validation.js";
import {handleToolError} from "../handle-error.js";
import * as s from "../schema.js";
import {server} from "./server.js";

export const edit_file_tool = safeRegisterTool2(
  server,
  "edit_file",
  {
    description: "Performs precise edits on a text file and allows choosing the return format for verification.",
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
