import fs from "node:fs";
import {EditConflictError} from "../error.js";

/**
 * Applies a series of edits to a file's content and returns the original and modified states.
 * @throws {EditConflictError} If the text to be replaced is not found.
 * @returns {{originalContent: string; modifiedContent: string}}
 */
export function applyFileEdits(filePath: string, edits: {oldText: string; newText: string}[]): {originalContent: string; modifiedContent: string} {
  const normalize = (text: string) => text.replace(/\r\n/g, "\n");
  const originalContent = normalize(fs.readFileSync(filePath, "utf-8"));
  let modifiedContent = originalContent;

  for (const edit of edits) {
    const normalizedOld = normalize(edit.oldText);
    const normalizedNew = normalize(edit.newText);
    if (modifiedContent.indexOf(normalizedOld) === -1) {
      throw new EditConflictError(`Could not apply edit: The text to be replaced was not found in the file.\n--- TEXT NOT FOUND ---\n${edit.oldText}`);
    }
    modifiedContent = modifiedContent.replace(normalizedOld, normalizedNew);
  }
  return {originalContent, modifiedContent};
}
