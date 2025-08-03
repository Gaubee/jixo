import {blue, cyan, gray, green, magenta, red} from "@gaubee/nodekit";
import {func_remember} from "@gaubee/util";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {defineFunctionCalls, type FunctionCallsMap} from "./function_call.js";
import {zContentSchema} from "./types.js";
export interface GoogleAiStudioAutomationOptions {
  dir?: string;
}

const parseContent = async (fcs: FunctionCallsMap, dir: string, basename: string, contentFilepath: string, filenames: string[]) => {
  console.log(magenta("开始处理文件"), path.relative(process.cwd(), contentFilepath));
  const fileData = await zContentSchema.parse(JSON.parse(reactiveFs.readFile(contentFilepath)));
  const {contents} = fileData.generateContentParameters;
  const latestContent = contents.at(-1);
  if (!latestContent) {
    return;
  }

  if (latestContent.role !== "user") {
    return;
  }
  // console.log("QAQ latestContent", latestContent);
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
    console.log(gray("发现任务已经有输入的内容，跳过任务"));
    return;
  }

  const modelIndex = contents.indexOf(modelContent);
  const hash = createHash("sha256").update(`INDEX:${modelIndex}`).update(JSON.stringify(modelContent)).digest("hex").slice(0, 8);
  const taskFilename = `${basename}.${functionCallPart.name}.${modelIndex}-${hash}.function_call.json`;

  if (filenames.includes(taskFilename)) {
    return;
  }

  console.log(blue("收到 functionCallPart 任务请求"), functionCallPart);

  const fc = fcs.get(functionCallPart.name);

  if (!fc) {
    console.warn("找不到任务处理工具");
    return false;
  } else {
    const {functionCall} = await fc.module;
    const input = JSON.parse(functionCallPart.parameters);
    try {
      console.log(cyan("开始执行任务"));
      const output = await functionCall(input);
      console.log(green("生成任务结果:"), taskFilename);
      fs.writeFileSync(path.join(dir, taskFilename), JSON.stringify({input, output}, null, 2));
      return true;
    } catch (e) {
      console.log(red("任务执行失败:"), e);
      return false;
    }
  }
};
const getFunctionCalls = func_remember(async (dir: string) => {
  const fcs = await defineFunctionCalls(dir);
  if (fcs.size === 0) {
    console.log(red("No Found functionCalls"));
    return;
  }
  console.log(green(`Found functionCalls (${fcs.size}):`));
  for (const [index, [name, fc]] of Array.from(fcs).entries()) {
    console.log(gray(`${index + 1}.`), blue(name), fc.module.description ?? "");
  }
  return fcs;
});
export const googleAiStudioAutomation = async ({dir = process.cwd()}: GoogleAiStudioAutomationOptions) => {
  const fcs = await getFunctionCalls(dir);
  if (!fcs) {
    return;
  }

  const contentNames = reactiveFs.readDirByGlob(dir, "*.contents.json");
  if (contentNames.length === 0) {
    console.log(red("No Found aistudio browser output contents file"));
    return;
  }
  console.log(gray(new Date().toLocaleTimeString()), magenta("处理开始"));
  for (const contentFilename of contentNames) {
    const contentFilepath = path.join(dir, contentFilename);
    const basename = contentFilename.replace(".contents.json", "");
    try {
      const result = await parseContent(fcs, dir, basename, contentFilepath, contentNames).catch(console.error);
    } catch (e) {
      console.error(red(e instanceof Error ? (e.stack ?? e.message) : String(e)));
    }
  }
  console.log(gray(new Date().toLocaleTimeString()), magenta("处理结束"));
};
