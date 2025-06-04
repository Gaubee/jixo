import {createAnthropic} from "@ai-sdk/anthropic";
import {createDeepInfra} from "@ai-sdk/deepinfra";
import {createDeepSeek} from "@ai-sdk/deepseek";
import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI} from "@ai-sdk/openai";
import {createXai} from "@ai-sdk/xai";
import {spinner} from "@gaubee/nodekit";
import {obj_lazify} from "@gaubee/util";
import {streamText, type ModelMessage} from "ai";
import {match, P} from "ts-pattern";
import {safeEnv} from "../env";

// const wrapper = (provider:)
export const providers = obj_lazify({
  get deepseek() {
    return createDeepSeek({
      baseURL: safeEnv.JIXO_DEEPSEEK_BASE_URL || undefined,
      apiKey: safeEnv.JIXO_DEEPSEEK_API_KEY,
    });
  },
  get anthropic() {
    // const bashTool = anthropic.tools.bash_20250124({
    //   execute: async ({command, restart}) => execSync(command).toString(),
    // });

    const provider = createAnthropic({
      baseURL: safeEnv.JIXO_ANTHROPIC_BASE_URL || undefined,
      apiKey: safeEnv.JIXO_ANTHROPIC_API_KEY,
    });
    return provider;
  },
  get google() {
    return createGoogleGenerativeAI({
      baseURL: safeEnv.JIXO_GOOGLE_BASE_URL || undefined,
      apiKey: safeEnv.JIXO_GOOGLE_API_KEY,
    });
  },
  get openai() {
    return createOpenAI({
      baseURL: safeEnv.JIXO_OPENAI_BASE_URL || undefined,
      apiKey: safeEnv.JIXO_OPENAI_API_KEY,
      organization: safeEnv.JIXO_OPENAI_ORGANIZATION || undefined,
    });
  },
  get xai() {
    return createXai({
      baseURL: safeEnv.JIXO_XAI_BASE_URL || undefined,
      apiKey: safeEnv.JIXO_XAI_API_KEY,
    });
  },
  get deepinfra() {
    return createDeepInfra({
      baseURL: safeEnv.JIXO_DEEPINFRA_BASE_URL || undefined,
      apiKey: safeEnv.JIXO_DEEPINFRA_API_KEY,
    });
  },
});
const getModel = (model?: string) => {
  return match(model)
    .with(P.string.startsWith("deepseek-"), (model) => providers.deepseek(model))
    .otherwise(() => {
      if (safeEnv.JIXO_DEEPSEEK_API_KEY) {
        return providers.deepseek("deepseek-reasoner");
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

export const runAi = async (prompt: string, options: {model?: string; agents?: string[]}) => {
  const model = getModel(options.model);
  const modelMessage: ModelMessage[] = [
    //
    {role: "system", content: prompt},
  ];
  const result = streamText({
    model: model,
    prompt: modelMessage,
  });
  const loading = spinner.default(`Connecting To ${model.provider}...`);
  for await (const text of result.textStream) {
    loading.text = text;
  }
};
