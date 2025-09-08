import {blue} from "@gaubee/nodekit";
import fs from "node:fs/promises";
import path from "node:path";
import z from "zod";
import {defineFunctionCalls} from "../../tools/function_call.js";

export interface GenerateConfigOptions {
  workDir: string;
  toolsDir: string;
}

const CONFIG_TEMPLATE_FILENAME = "config-template.json";

// Basic structure for our config file
interface JixoConfig {
  tools?: z.core.JSONSchema.BaseSchema[];
  // other config sections like systemPrompt, model, etc. can be added here
}

export const generateConfigTemplate = async ({workDir, toolsDir}: GenerateConfigOptions) => {
  const functionCallModules = await defineFunctionCalls(toolsDir);

  const toolDeclarations = [...functionCallModules.values()].map((fc) => {
    const {name, description, paramsSchema} = fc.module;

    let parameters = {};
    if (paramsSchema) {
      // Convert Zod schema to JSON schema, handling potential errors
      try {
        parameters = z.toJSONSchema(z.object(paramsSchema));
      } catch (error) {
        console.warn(`Could not convert Zod schema to JSON schema for tool "${name}":`, error);
      }
    }

    return {
      name,
      description: description || "No description provided.",
      parameters,
    };
  });

  const configTemplatePath = path.join(workDir, CONFIG_TEMPLATE_FILENAME);
  let existingConfig: JixoConfig = {};

  try {
    const content = await fs.readFile(configTemplatePath, "utf-8");
    existingConfig = JSON.parse(content);
  } catch (error: any) {
    // Ignore if file doesn't exist, it's the first run.
    if (error?.code !== "ENOENT") {
      console.error(`Error reading existing config template:`, error);
    }
  }

  // Merge new tool declarations into the config
  const newConfig: JixoConfig = {
    ...existingConfig,
    tools: toolDeclarations,
  };

  await fs.writeFile(configTemplatePath, JSON.stringify(newConfig, null, 2));

  console.log(blue(`✅ Config template updated at: ${CONFIG_TEMPLATE_FILENAME}`));
};
