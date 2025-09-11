import {createResolver, } from "@gaubee/nodekit";
import {_gen_content} from "../../gen-prompt.js";
import type {AgentMetadata, PageConfig} from "../browser/index.js";
import { loadAgentTools } from "../../tools/load_tools.js";

/**
 * Dynamically generates a complete page configuration based on agent metadata.
 * This function is pure and has no side effects; it reads metadata and returns a config object.
 *
 * @param metadata - The agent metadata object.
 * @returns A promise that resolves to the generated PageConfig object.
 */
export const genPageConfig = async (metadata: AgentMetadata): Promise<PageConfig> => {
  const systemPromptTemplate: string[] = ["[JIXO:CODER2](@INJECT)"];

  // 1. Dynamically load tools from both built-in and user directories
  const {toolDeclarations} = await loadAgentTools(metadata);

  // 2. Build the system prompt template from metadata
  if (metadata) {
    if (metadata.dirs?.length) {
      systemPromptTemplate.push("\n# Relevant Directories:\n");
      metadata.dirs.forEach((dir) => systemPromptTemplate.push(`[${dir}](@FILE_TREE)`));
    }
    if (metadata.docs?.length) {
      systemPromptTemplate.push("\n# Reference Documents:\n");
      metadata.docs.forEach((doc) => systemPromptTemplate.push(`[${doc}](@FILE)`));
    }
    // MCP integration can be added here in the future
  }

  // 3. Use gen-prompt engine to render the final system prompt
  const workDirResolver = createResolver(metadata.workDir);
  const finalSystemPrompt = await _gen_content(
    (metadata.codeName || metadata.workDir.split(/[\/\\]+/).findLast((v) => !v.startsWith("."))) ?? "NoNameJob", // Use workDir name as codeName
    systemPromptTemplate.join("\n"),
    workDirResolver,
  );

  // 4. Construct the final config object
  const finalConfig: PageConfig = {
    model: "gemini-1.5-pro", // Or make this configurable via metadata
    systemPrompt: finalSystemPrompt,
    tools: toolDeclarations,
    metadata,
  };

  // 5. Add title if codeName is available
  if (metadata.agent && "codeName" in metadata && metadata.codeName) {
    const agentName = metadata.agent.charAt(0).toUpperCase() + metadata.agent.slice(1);
    finalConfig.title = `${agentName}: ${metadata.codeName}`;
  }

  return finalConfig;
};
