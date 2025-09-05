import {createResolver} from "@gaubee/nodekit";
import path from "node:path";
import {z} from "zod";
import {_gen_content} from "../../gen-prompt.js";
import type {AgentMetadata, PageConfig} from "../browser/index.js";
import {defineFunctionCalls} from "./function_call.js";

export interface GenPageConfigOptions {
  metadata?: AgentMetadata;
  workDir: string;
  toolsDir: string;
}

/**
 * Dynamically generates a complete page configuration based on agent metadata.
 * This function is pure and has no side effects; it reads metadata and returns a config object.
 *
 * @param options - Configuration options including metadata, work directory, and tools directory.
 * @returns A promise that resolves to the generated PageConfig object.
 */
export const genPageConfig = async (metadata: AgentMetadata): Promise<PageConfig> => {
  const systemPromptTemplate: string[] = ["[JIXO:CODER](@INJECT)"];
  const tools: Array<{name: string; description: string; parameters: any}> = [];

  const toolsDirs = [metadata.workDir, path.join(metadata.workDir, "tools")];
  for (const toolsDir of toolsDirs) {
    // 1. Dynamically generate tool declarations from the filesystem
    try {
      const functionCallModules = await defineFunctionCalls(toolsDir);
      for (const [baseName, fc] of functionCallModules) {
        const {name, description, paramsSchema} = fc.module;
        let parameters = {};
        if (paramsSchema) {
          try {
            // Convert Zod schema to JSON schema for the tool definition
            parameters = z.toJSONSchema(z.object(paramsSchema));
          } catch (error) {
            console.warn(`Could not convert Zod schema for tool "${name}":`, error);
          }
        }
        tools.push({
          name: name ?? baseName,
          description: description || "No description provided.",
          parameters,
        });
      }
    } catch (error) {
      console.error(`Error defining function calls from ${toolsDir}:`, error);
    }
  }

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

  const finalConfig: PageConfig = {
    model: "gemini-2.5-pro", // Or make this configurable via metadata
    systemPrompt: finalSystemPrompt,
    tools,
    metadata,
  };

  return finalConfig;
};
