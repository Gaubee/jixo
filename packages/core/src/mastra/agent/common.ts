import {Agent, type CoreMessage, type MastraStorage} from "@mastra/core";
import type {AgentGenerateOptions} from "@mastra/core/agent";
import type {ZodSchema} from "zod";
import {commonModel} from "../llm/index.js";

const structuredOutputAgent = new Agent({
  name: "StructuredOutputAgent",
  instructions: `# Structured Data Transformer

## Mission
Convert unstructured input text into precise JSON matching the EXACT structure and semantics of the provided output schema.

## Core Principles
1. **Schema as sole authority**  
   - Strictly adhere to field names, types, and descriptions in provided schema
   - Never add/remove/modify schema-defined fields

2. **Zero-hallucination extraction**  
   - Extract ONLY information present in input text
   - Never infer missing values - leave fields undefined if not found

3. **Literal fidelity**  
   - Preserve original phrasing when possible
   - Convert implicit relationships to explicit structure

## Output Rules
✅ MUST output pure JSON (no formatting, no explanations)  
✅ MUST maintain original data semantics  
✅ MUST reject schema-incompatible creative interpretations  
❌ NEVER insert default values  
❌ NEVER compensate for missing information`,
  model: commonModel,
});

export type CreateAgentOptions = {jobDir: string; memoryStorage: MastraStorage};
export const agentGenerateStructuredOutput = async <O extends ZodSchema>(
  agent: Agent<any, {}, {}>,
  message: string | CoreMessage[],
  output: O,
  opts: Pick<AgentGenerateOptions, "runtimeContext" | "toolsets">, // Omit< AgentGenerateOptions,'output'|'experimental_output'> ,
) => {
  // if (true) {
  /// 首先执行任务
  const result = await agent.generate(message, {
    ...opts,
    // experimental_output: ExecutionResultSchema,
  });

  /// 然后返回结构体
  const result2 = await structuredOutputAgent.generate(result.text, {
    output: output,
  });

  return result2.object;
  // } else {
  //   const result2 = await agent.generate(message, {
  //     ...opts,
  //     experimental_output: output,
  //   });
  //   return result2.object;
  // }
};
