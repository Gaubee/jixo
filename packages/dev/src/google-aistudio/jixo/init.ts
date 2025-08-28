import {blue, gray, prompts, readJson, yellow} from "@gaubee/nodekit";
import {func_remember, obj_props} from "@gaubee/util";
import {existsSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {assetsResolver} from "../../utils/resolver.js";
const GET_JIXO_TOOLS = func_remember(() => readJson<Record<string, string>>(assetsResolver("tools.json")));

export interface InitOptions {
  dir: string;
  force?: boolean;
}

export const copyAssets = async (targetDir: string, options: {force?: boolean}) => {
  const tools = await GET_JIXO_TOOLS();
  await mkdir(targetDir, {recursive: true});
  for (const filename of obj_props(tools)) {
    const destPath = path.join(targetDir, filename);
    if (existsSync(destPath)) {
      if (options.force === false) {
        console.warn(yellow(`File already exists, skipping: ${filename}`));
        continue;
      }
      if (options.force == null) {
        const overwrite = await prompts.confirm({
          message: `File '${blue(filename)}' already exists. Overwrite?`,
          default: false,
        });
        if (!overwrite) continue;
      }
    }
    await writeFile(destPath, tools[filename]);
  }
};

export const initTools = async ({dir, force}: InitOptions) => {
  console.log(gray(`Initializing tools in ${dir}...`));
  await copyAssets(dir, {force});
  console.log(blue("✅ Tools initialized successfully."));
};

export const doInit = (opts: InitOptions) => {
  // This function is now legacy, kept for potential direct use.
  const sourceDir = assetsResolver("bundle", "google-aistudio.browser.js");
  return copyAssets(opts.dir, {force: opts.force});
};
