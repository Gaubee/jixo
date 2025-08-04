import {blue, gray, prompts, yellow} from "@gaubee/nodekit";
import {existsSync} from "node:fs";
import {copyFile, mkdir, rm} from "node:fs/promises";
import path from "node:path";
import {assetsResolver} from "../../utils/resolver.js";

export interface InitOptions {
  dir: string;
  force?: boolean;
}
export const commonInit = async (cpAssets: string[], {dir, force}: InitOptions) => {
  const sourceEntries = cpAssets.map((entrypath) => ({relativepath: entrypath, fullpath: assetsResolver(`bundle`, entrypath)}));
  const targetEntries = cpAssets.map((entrypath) => ({relativepath: entrypath, fullpath: path.resolve(dir, entrypath)}));
  const existEntries = targetEntries.filter((targetEntry) => existsSync(targetEntry.fullpath));

  if (existEntries.length) {
    const logPaths = () => existEntries.map((entry) => `${gray("-")} ${blue(entry.relativepath)}`);
    if (force === false) {
      console.warn(
        [
          //
          yellow(`the same file(s) name already exists.`),
          ...logPaths(),
        ].join("\n"),
      );
      return;
    }
    if (force == null) {
      const overwrite = await prompts.confirm({
        message: [
          //
          `the same file(s) name already exists. Are you sure you want to overwrite?`,
          ...logPaths(),
        ].join("\n"),
        default: false,
      });
      if (!overwrite) {
        return;
      }
    }

    await Promise.all(existEntries.map((entry) => rm(entry.fullpath, {recursive: true})));
  }
  await mkdir(dir, {recursive: true});
  for (const [index, sourceEntry] of sourceEntries.entries()) {
    await copyFile(sourceEntry.fullpath, targetEntries[index].fullpath);
  }
  await Promise.all(
    sourceEntries.map((sourceEntry, index) => {
      return copyFile(sourceEntry.fullpath, targetEntries[index].fullpath);
    }),
  );
};
export const doInit = (opts: InitOptions) => {
  return commonInit(["google-aistudio.browser.js"], opts);
};
