import path from "node:path";
import {type AgentMetadata} from "../browser/index.js";

export interface GenPageConfigOptions {
  metadata?: AgentMetadata;
}

/**
 * Generates a configuration file based on provided metadata.
 * In the future, this will call gen-prompt to produce a sophisticated system prompt.
 *
 * @JIXO 这个函数暂时留作TODO：
 * <todo>
 * 这里应该使用 gen_prompt 函数来进行生成 systemPrompt。
 * 以jixo-coder为例，传入的参数应该是：
 * ```js
 * {
 *   agent: "coder",// 声明使用coder模式，以下的配置将针对coder，最终生成系统提示词和tools
 *   dirs: ["/xxx/xxx","xxx/ccc"], // 指定要处理的目录
 *   docs: ["/xxx"], // 知识库文件夹或者文件
 *   mcp: ["pnpx xxx"], // 一些额外的mcp配置，会被自动转成 tools
 * }
 * ```
 * </todo>
 */
export const genPageConfig = async ({metadata}: GenPageConfigOptions) => {
  const systemPromptLines = ["You are a helpful assistant."];
  const tools: any[] = [];

  if (metadata) {
    if (metadata.dirs?.length) {
      systemPromptLines.push("\n# Relevant Directories:\n" + metadata.dirs.join("\n"));
    }
    if (metadata.docs?.length) {
      systemPromptLines.push("\n# Reference Documents:\n" + metadata.docs.join("\n"));
    }
    if (metadata.mcp?.length) {
      // Placeholder: In the future, we'll execute these commands to get tool schemas.
      // For now, we just create dummy tool definitions.
      metadata.mcp.forEach((m) => {
        if (m.command) {
          tools.push({
            name: `${m.prefix || ""}${path.basename(m.command)}`,
            description: `A tool generated from the MCP command: ${m.command}`,
            parameters: {type: "object", properties: {}},
          });
        }
      });
    }
  }

  const finalConfig = {
    model: "gemini-1.5-pro-latest",
    systemPrompt: systemPromptLines.join("\n"),
    tools,
    metadata, // Persist the metadata
  };

  return finalConfig;
};
