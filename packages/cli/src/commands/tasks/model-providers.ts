import {createAnthropic} from "@ai-sdk/anthropic";
import {createDeepInfra} from "@ai-sdk/deepinfra";
import {createDeepSeek} from "@ai-sdk/deepseek";
import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI} from "@ai-sdk/openai";
import {createXai} from "@ai-sdk/xai";
import {obj_lazify} from "@gaubee/util";
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
