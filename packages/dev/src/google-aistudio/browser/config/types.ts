import {z} from "../../node/z-min.js";

export const zBaseAgentMetadata = z.object({
  /// 工作目录
  workDir: z.string(),
});
export type BaseAgentMetadata = z.output<typeof zBaseAgentMetadata>;

export const zCoderAgentMetadata = z.extend(zBaseAgentMetadata, {
  agent: z.literal("coder"),
  /// 任务代号
  codeName: z.string(),
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
  title: z.optional(z.string()),
});

export type PageConfig = z.output<typeof zPageConfig>;
