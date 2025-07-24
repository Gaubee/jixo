import {prompts} from "@gaubee/nodekit";
import fs from "node:fs";
import path from "node:path";
import prettier from "prettier";
import {match} from "ts-pattern";
import {logger} from "./logger.js";
import type {DiffFiles} from "./parser.js";

const fsp = fs.promises;

type FormatCodeOptions = {
  filepath: string;
  prettierParser?: prettier.LiteralUnion<prettier.BuiltInParserName, string>;
};

/**
 * Formats a given code string using Prettier.
 * @param filecode - The code string to format.
 * @param options - Options including the file path for config resolution.
 * @returns The formatted code.
 */
async function formatCode(filecode: string, {filepath, prettierParser}: FormatCodeOptions): Promise<string> {
  const fileInfo = await prettier.getFileInfo(filepath);
  if (fileInfo.ignored) {
    logger.info(`File ${path.relative(process.cwd(), filepath)} is ignored by .prettierignore.`);
    return filecode;
  }

  const fileparser = prettierParser ?? fileInfo?.inferredParser;

  if (!fileparser) {
    logger.warn(`Could not infer parser for ${path.relative(process.cwd(), filepath)}, skipping formatting.`);
    return filecode;
  }
  const config = await prettier.resolveConfig(filepath);

  return prettier.format(filecode, {
    ...config,
    parser: fileparser,
  });
}

/**
 * Applies the changes described by the DiffFiles to the filesystem.
 * @param files - An array of DiffFile objects.
 * @param format - Whether to format the code using Prettier before writing.
 */
export async function applyChanges(files: DiffFiles, format?: boolean): Promise<void> {
  for (const file of files) {
    const writeFile = async (filepath = file.fullSourcePath, filecode: string = file.code) => {
      let contentToWrite = filecode;
      if (format && file.mode !== "delete" && filecode) {
        contentToWrite = await formatCode(filecode, {filepath});
      }
      await fsp.writeFile(filepath, contentToWrite, "utf-8");
    };

    try {
      await match(file.mode)
        .with("add", "modify", async () => {
          const dirName = path.dirname(file.fullSourcePath);
          await fsp.mkdir(dirName, {recursive: true});
          await writeFile();
          logger.success(`Successfully ${file.mode === "add" ? "created" : "updated"} file: ${logger.file(file.filePath)}`);
        })
        .with("delete", async () => {
          await fsp.rm(file.fullSourcePath, {recursive: true, force: true});
          logger.success(`Successfully deleted file: ${logger.file(file.filePath)}`);
        })
        .with("rename", "rename+modify", async (mode) => {
          await fsp.mkdir(path.dirname(file.fullTargetPath), {recursive: true});
          await fsp.rename(file.fullSourcePath, file.fullTargetPath);
          const relativeTargetPath = path.relative(process.cwd(), file.fullTargetPath);

          if (mode.includes("modify")) {
            await writeFile(file.fullTargetPath);
            logger.success(`Successfully renamed and updated file: ${logger.file(file.filePath)} => ${logger.file(relativeTargetPath)}`);
          } else {
            logger.success(`Successfully renamed file: ${logger.file(file.filePath)} => ${logger.file(relativeTargetPath)}`);
          }
        })
        .exhaustive();
    } catch (error) {
      logger.error(`Failed to ${file.mode} file ${logger.file(file.filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Prompts the user to confirm which files to update.
 * @param filesToUpdate - The list of files proposed for changes.
 * @param options - Options including a top message and whether to allow unsafe paths.
 * @returns A filtered list of files that the user confirmed.
 */
export async function confirmAction(filesToUpdate: DiffFiles, options: {topMessage?: string; allowUnsafe?: boolean}): Promise<DiffFiles> {
  if (filesToUpdate.length === 0) {
    return [];
  }

  console.log("\n-----------------------------------------");

  type CheckboxChoice = ReturnType<typeof prompts.checkbox> extends Promise<infer R> ? (R extends Array<infer I> ? I : never) : never;

  const choices: {name: string; value: string; checked: boolean}[] = [];
  let currentFrom = "";

  for (const file of filesToUpdate) {
    if (file.from !== currentFrom) {
      // This requires prompts library to support Separator objects, let's use a string for now.
      // choices.push(new prompts.Separator(currentFrom = file.from));
      currentFrom = file.from;
    }
    choices.push({
      name: [logger.mode(file.mode) + (file.safe ? "" : " ⚠️"), logger.file(file.filePath)].join("\t"),
      value: file.filePath,
      checked: file.safe || !!options.allowUnsafe,
    });
  }

  const selectedFiles = await prompts.checkbox({
    message: [options.topMessage, "The following files will be overwritten:\n"].filter(Boolean).join("\n"),
    choices: choices,
    pageSize: process.stdout.rows > 0 ? process.stdout.rows - 4 : filesToUpdate.length, // Leave space for prompt
  });

  console.log("-----------------------------------------");
  return filesToUpdate.filter((file) => (selectedFiles as string[]).includes(file.filePath));
}
