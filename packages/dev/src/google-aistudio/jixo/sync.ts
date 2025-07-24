import {blue, green} from "@gaubee/nodekit";
import {iter_map_not_null} from "@gaubee/util";
import {statSync} from "node:fs";
import {writeFile} from "node:fs/promises";
import path from "node:path";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {zContentSchema} from "../node/types.js";

export const sync = async (basePath: string, outDir?: string) => {
  const s = statSync(basePath);
  if (s.isDirectory()) {
    for (const contentsJsonFile of reactiveFs.readDir(basePath, "*.contents.json").get()) {
      sync(path.join(basePath, contentsJsonFile), outDir);
    }
    return;
  }
  const safeContents = await zContentSchema.safeParseAsync(JSON.parse(reactiveFs.getFile(basePath).get()));
  if (safeContents.error) {
    console.error(safeContents.error);
    return;
  }
  const contents = safeContents.data;

  let first_index = 0;
  let second_index = -1;
  const modelHistory = iter_map_not_null(contents.generateContentParameters.contents, (content) => {
    if (content.role === "model") {
      const textParts = content.parts.filter((p) => "text" in p);
      return textParts.at(-1)?.text;
    }
  });
  const name_len = 2; // 固定长度，避免抖动
  const model_files = modelHistory.map((content) => {
    if (content.includes("【变更日志】")) {
      first_index += 1;
      second_index = 0;
    } else {
      second_index += 1;
    }
    const name = `${first_index}`.padStart(name_len, "0") + "-" + `${second_index}`.padStart(name_len, "0") + ".md";
    return {name, content};
  });

  outDir ??= path.dirname(basePath);
  for (const file of model_files) {
    await writeFile(path.join(outDir, file.name), file.content);
  }

  console.log(blue(new Date().toLocaleTimeString()), green("sync"), path.relative(process.cwd(), basePath));
};
