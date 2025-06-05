import {cyan, FileEntry, gray, green, spinner} from "@gaubee/nodekit";
import {streamText, type ModelMessage} from "ai";
import {match, P} from "ts-pattern";
import {safeEnv} from "../../env.js";
import {getModelMessage, getPromptConfigs} from "../../helper/prompts-loader.js";
import type {AiTask} from "../../helper/resolve-ai-tasks.js";
import {tools} from "./ai-tools.js";
import {providers} from "./model-providers.js";

const getModel = (model?: string) => {
  return match(model)
    .with(P.string.startsWith("deepseek-"), (model) => providers.deepseek(model))
    .otherwise(() => {
      if (safeEnv.JIXO_DEEPSEEK_API_KEY) {
        return providers.deepseek("deepseek-chat");
      }
      if (safeEnv.JIXO_GOOGLE_API_KEY) {
        return providers.google("gemini-2.5-pro-preview-05-06");
      }
      if (safeEnv.JIXO_OPENAI_API_KEY) {
        return providers.openai("o3-mini");
      }
      if (safeEnv.JIXO_ANTHROPIC_API_KEY) {
        return providers.anthropic("claude-4-sonnet-20250514");
      }
      if (safeEnv.JIXO_XAI_API_KEY) {
        return providers.xai("grok-3-beta");
      }
      if (safeEnv.JIXO_DEEPINFRA_API_KEY) {
        return providers.deepinfra("meta-llama/Meta-Llama-3.1-405B-Instruct");
      }
      return providers.deepseek("deepseek-reasoner");
    });
};

export const runAiTask = async (ai_task: AiTask, allFiles: FileEntry[], changedFiles: FileEntry[]) => {
  const model = getModel(ai_task.model);

  const modelMessage: ModelMessage[] = getModelMessage(ai_task.agents);
  modelMessage.push(
    //
    {
      role: "system",
      content: getPromptConfigs()
        .base.content //
        .replaceAll("{{task.name}}", ai_task.name)
        .replaceAll("{{task.memory}}", ai_task.memory)
        .replaceAll("{{task.content}}", ai_task.content)
        .replaceAll("{{allFiles}}", allFiles.map((file) => `- ${file.path}`).join("\n"))
        .replaceAll("{{changedFiles}}", changedFiles.map((file) => `- ${file.path}`).join("\n")),
    },
  );
  // console.log("QAQ modelMessage", modelMessage);
  // return;
  const result = streamText({
    model: model,
    prompt: modelMessage,
    tools: {
      ...(await tools.fileSystem(ai_task.cwd)),
      // ...(await tools.fetch()),
      // ...(await tools.git(ai_task.cwd)),
    },
    onChunk: ({chunk}) => {
      if (chunk.type === "reasoning") {
        if (reasoning === "") {
          loading.prefixText = "🤔 ";
          loading.text = "";
        }
        reasoning += chunk.text;
        loading.text = gray(reasoning.split("\n").slice(-3).join("\n"));
      }
    },
  });
  const loading = spinner.default(`Connecting To ${model.provider}...`);
  loading.prefixText = "⏳ ";
  loading.start();
  let reasoning = "";
  let fulltext = "";
  for await (const text of result.textStream) {
    if (fulltext === "") {
      loading.prefixText = "🤖 ";
      loading.text = "";
      fulltext = "\n";
    }
    fulltext += text;
    loading.text = fulltext;
  }

  loading.stopAndPersist({
    suffixText: green(`\n✅ ${cyan(`[${ai_task.name}]`)} Completed\n`),
  });

  console.log("QAQ done", result);
};
