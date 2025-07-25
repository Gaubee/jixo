import {gray} from "@gaubee/nodekit";
import {func_debounce} from "@gaubee/util";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {zContentSchema} from "./types.js";
export const doGoogleAiStudioAutomation = (dir: string = process.cwd()) => {
  const watcher = fs.watch(dir);
  const handle = func_debounce(async () => {
    const names = fs.readdirSync(dir);
    const contentNames = names.filter((name) => name.endsWith(".contents.json"));
    for (const contentFilename of contentNames) {
      const contentFilepath = path.join(dir, contentFilename);
      const basename = contentFilename.replace(".contents.json", "");
      await parseContent(basename, contentFilepath, names).catch(console.error);
    }
  }, 200);

  const parseContent = async (basename: string, contentFilepath: string, filenames: string[]) => {
    const fileData = await zContentSchema.parse(JSON.parse(fs.readFileSync(contentFilepath, "utf-8")));
    const {contents} = fileData.generateContentParameters;
    const latestContent = contents.at(-1);
    if (!latestContent) {
      return;
    }

    if (latestContent.role !== "user") {
      return;
    }
    console.log("QAQ latestContent", latestContent);
    const functionResponsePart = latestContent.parts.find((p) => "functionResponse" in p);
    if (!functionResponsePart) {
      return;
    }
    /// 已经有输入了，那么就跳过
    if (functionResponsePart.functionResponse.response !== "") {
      return;
    }

    const modelContent = contents.findLast((content) => {
      return content.role === "model" && content.parts.find((p) => "functionCall" in p);
    });
    if (!modelContent) {
      return;
    }
    const functionCallPart = modelContent.parts.find((p) => "functionCall" in p)?.functionCall;
    if (!functionCallPart) {
      return;
    }

    const modelIndex = contents.indexOf(modelContent);
    const hash = createHash("sha256").update(`INDEX:${modelIndex}`).update(JSON.stringify(modelContent)).digest("hex").slice(0, 8);
    const taskFilename = `${basename}.${functionCallPart.name}.${modelIndex}-${hash}.function_call.json`;

    if (filenames.includes(taskFilename)) {
      return;
    }
    for (const scriptFilename of [`${functionCallPart.name}.function_call.js`, `${functionCallPart.name}.function_call.ts`]) {
      const scriptFilepath = path.join(dir, scriptFilename);
      if (fs.existsSync(scriptFilepath)) {
        const {functionCall} = await import(pathToFileURL(scriptFilepath).href);
        const input = JSON.parse(functionCallPart.parameters);
        const output = await functionCall(input);
        console.log("QAQ output", output);
        console.log("WRITE TASK FILE:", taskFilename);
        fs.writeFileSync(path.join(dir, taskFilename), JSON.stringify({input, output}, null, 2));
      }
    }
  };

  watcher.on("change", (eventType) => {
    if (eventType === "delete" || eventType === "unlink") {
      return;
    }
    handle();
  });
  handle();
  console.log(gray("\nWatching for file changes... Press Ctrl+C to exit."));
};
