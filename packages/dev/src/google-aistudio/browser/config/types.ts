import {z} from "../../node/z-min.js";

export const zCoderAgentMetadata = z.object({
  agent: z.literal("coder"),
  dirs: z.array(z.string()),
  docs: z.array(z.string()),
  mcp: z.array(z.object({command: z.string(), prefix: z.optional(z.string())})),
});
export type CoderAgentMetadata = z.output<typeof zCoderAgentMetadata>;

export const zAgentMetadata = z.union([zCoderAgentMetadata]);
export type AgentMetadata = z.output<typeof zAgentMetadata>;
export const zPageConfig = z.object({
  metadata: z.optional(zAgentMetadata),
  model: z.string(),
  systemPrompt: z.string(),
  tools: z.array(z.any()),
});

export type PageConfig = z.output<typeof zPageConfig>;
