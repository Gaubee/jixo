import {createAnthropic} from "@ai-sdk/anthropic";
import {createDeepInfra} from "@ai-sdk/deepinfra";
import {createDeepSeek} from "@ai-sdk/deepseek";
import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI, type OpenAIProvider} from "@ai-sdk/openai";
import {createXai} from "@ai-sdk/xai";
import {obj_lazify} from "@gaubee/util";
import {match, P} from "ts-pattern";
import {safeEnv} from "../../env.js";

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

type LanguageModelV2 = ReturnType<OpenAIProvider>;
export const getModel = (model?: string): LanguageModelV2 => {
  return match(model)
    .with(P.string.startsWith("deepseek-"), (model) => providers.deepseek(model))
    .with(P.string.startsWith("gemini-"), (model) => providers.google(model))
    .with(P.string.startsWith("o3-"), P.string.startsWith("o1-"), P.string.startsWith("gpt-"), (model) => providers.openai(model))
    .with(P.string.startsWith("claude-"), (model) => providers.anthropic(model))
    .with(P.string.startsWith("grok-"), (model) => providers.xai(model))
    .with(P.string.includes("/"), (model) => providers.deepinfra(model))
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
