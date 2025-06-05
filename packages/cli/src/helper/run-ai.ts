import {createAnthropic} from "@ai-sdk/anthropic";
import {createDeepInfra} from "@ai-sdk/deepinfra";
import {createDeepSeek} from "@ai-sdk/deepseek";
import {createGoogleGenerativeAI} from "@ai-sdk/google";
import {createOpenAI} from "@ai-sdk/openai";
import {createXai} from "@ai-sdk/xai";
import {cyan, FileEntry, gray, green, spinner} from "@gaubee/nodekit";
import {func_lazy, func_remember, map_get_or_put_async, obj_lazify} from "@gaubee/util";
import {experimental_createMCPClient as createMCPClient, streamText, type ModelMessage, type ToolSet} from "ai";
import {Experimental_StdioMCPTransport} from "ai/mcp-stdio";
import {match, P} from "ts-pattern";
import {safeEnv} from "../env.js";
import {getModelMessage, getPromptConfigs} from "./prompts-loader.js";
import type {AiTask} from "./resolve-ai-tasks.js";

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
        return providers.deepseek("deepseek-coder");
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

const tools = {
  fileSystem: func_lazy(() => {
    const map = new Map<string, ToolSet>();
    return (cwd: string) => {
      return map_get_or_put_async(map, cwd, async () => {
        const mcpClient = await createMCPClient({
          transport: new Experimental_StdioMCPTransport({
            command: "pnpx",
            args: ["@modelcontextprotocol/server-filesystem", cwd],
          }),
        });
        const tools = await mcpClient.tools();
        return tools;
      });
    };
  }),
  fetch: func_remember(async () => {
    const mcpClient = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: "uvx",
        args: ["mcp-server-fetch"],
      }),
    });
    const tools = await mcpClient.tools();
    return tools;
  }),
  git: func_lazy(() => {
    const map = new Map<string, ToolSet>();

    return (repo: string) => {
      return map_get_or_put_async(map, repo, async () => {
        const mcpClient = await createMCPClient({
          transport: new Experimental_StdioMCPTransport({
            command: "uvx",
            args: ["mcp-server-git", "--repository", repo],
          }),
        });
        const tools = await mcpClient.tools();
        return tools;
      });
    };
  }),
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
          loading.text = "";
        }
        reasoning += chunk.text;
        loading.text = gray(reasoning);
      }
    },
  });
  const loading = spinner.default(`Connecting To ${model.provider}...`);
  loading.prefixText = "⏳ ";
  loading.start();
  let reasoning = "";
  let first = true;
  for await (const text of result.textStream) {
    if (first) {
      first = false;
      loading.text = "";
    }
    loading.text += text;
  }

  loading.stopAndPersist({
    prefixText: "🤖 ",
    suffixText: green(`\n✅ ${cyan(`[${ai_task.name}]`)} Completed\n`),
  });

  console.log("QAQ done", result.text);
};
