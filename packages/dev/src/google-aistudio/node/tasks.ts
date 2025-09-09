import {blue, bold, cyan, gray, green, magenta, red} from "@gaubee/nodekit";
import {func_remember} from "@gaubee/util";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {createFunctionCallContext, defineFunctionCalls, type FunctionCallsMap} from "../../tools/function_call.js";
import {zContentsSchema} from "./types.js";
export interface GoogleAiStudioAutomationOptions {
  dir?: string; // This is now the WORK_DIR
  toolsDir?: string; // The specific directory to load tools from
}

const parseContent = async (fcs: FunctionCallsMap, dir: string, basename: string, contentFilepath: string, filenames: string[]) => {
  console.log(magenta("开始处理文件"), path.relative(process.cwd(), contentFilepath));
  const contents = await zContentsSchema.parse(JSON.parse(reactiveFs.readFile(contentFilepath)));

  // Find the last user message that contains a functionResponse part.
  const latestUserContent = contents.findLast((c) => {
    return c.role === "user" && c.parts.some((p) => "functionResponse" in p);
  });
  if (!latestUserContent) return;

  // Ensure the functionResponse part is empty, meaning it's waiting for our input.
  const functionResponsePart = latestUserContent.parts.find((p) => "functionResponse" in p);
  if (!functionResponsePart || (functionResponsePart as any).functionResponse.response !== "") return;

  // Find the preceding model message that contains the corresponding functionCall.
  const modelContent = contents.slice(0, contents.lastIndexOf(latestUserContent)).findLast((content) => {
    return content.role === "model" && content.parts.some((p) => "functionCall" in p);
  });
  if (!modelContent) return;

  const functionCallPart = modelContent.parts.find((p) => "functionCall" in p)?.["functionCall"];
  if (!functionCallPart) return;

  const modelIndex = contents.indexOf(modelContent);
  const hash = createHash("sha256").update(`INDEX:${modelIndex}`).update(JSON.stringify(modelContent)).digest("hex").slice(0, 8);
  const taskFilename = `${basename}.${functionCallPart.name}.${modelIndex}-${hash}.function_call.json`;

  if (filenames.includes(taskFilename)) {
    // A result file already exists, so we skip this task.
    return;
  }

  console.log(blue("收到 functionCallPart 任务请求"), functionCallPart);

  const fc = fcs.get(functionCallPart.name);

  if (!fc) {
    console.warn("找不到任务处理工具");
    return false;
  } else {
    const {functionCall} = fc.module;
    const input = JSON.parse(functionCallPart.parameters);
    try {
      console.log(cyan("开始执行任务"));

      // TODO: Replace this with a real session ID from the context.
      const sessionId = basename; // Using the file basename as the session ID for now.
      const context = createFunctionCallContext(sessionId);

      const output = await functionCall(input, context);

      console.log(green("生成任务结果:"), taskFilename);
      fs.writeFileSync(path.join(dir, taskFilename), JSON.stringify({...functionCallPart, input, output}, null, 2));
      return true;
    } catch (e) {
      console.log(red("任务执行失败:"), e);
      fs.writeFileSync(path.join(dir, taskFilename), JSON.stringify({...functionCallPart, input, output: {error: e instanceof Error ? e.message : String(e)}}, null, 2));
      return false;
    }
  }
};

const getFunctionCalls = func_remember(async (toolsDir: string) => {
  const fcs = await defineFunctionCalls(toolsDir);
  if (fcs.size === 0) {
    console.log(red(`No function calls found in ${toolsDir}`));
    return;
  }
  console.log(green(`Found functionCalls (${fcs.size}):`));
  for (const [index, [name, fc]] of Array.from(fcs).entries()) {
    console.log(gray(`${index + 1}.`), bold(blue(name)), gray(fc.module.description ? `: ${fc.module.description}` : ""));
  }
  console.log(green("─".repeat(process.stdout.columns ?? 20)));
  return fcs;
});

export const googleAiStudioAutomation = async ({dir = process.cwd(), toolsDir}: GoogleAiStudioAutomationOptions) => {
  const finalToolsDir = toolsDir || path.join(dir, "tools");
  const fcs = await getFunctionCalls(finalToolsDir);
  if (!fcs) return;

  const contentNames = reactiveFs.readDirByGlob(dir, "*.contents.json");
  if (contentNames.length === 0) {
    console.log(red(`No Found aistudio browser output contents file in ${dir}`));
    return;
  }

  console.log(gray(new Date().toLocaleTimeString()), magenta("Processing content files..."));
  for (const contentFilename of contentNames) {
    const contentFilepath = path.join(dir, contentFilename);
    const basename = contentFilename.replace(".contents.json", "");
    try {
      await parseContent(fcs, dir, basename, contentFilepath, contentNames).catch(console.error);
    } catch (e) {
      console.error(red(e instanceof Error ? (e.stack ?? e.message) : String(e)));
    }
  }
  console.log(gray(new Date().toLocaleTimeString()), magenta("Processing finished."));
};
