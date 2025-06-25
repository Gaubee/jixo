import {createTool} from "@mastra/core";
import type {ToolsInput} from "@mastra/core/agent";
import {spawn, type ChildProcessWithoutNullStreams} from "node:child_process";
import {z} from "zod";
const NodeCliInputSchema = z.object({
  NoWarnings: z.boolean().optional(),
  NoDeprecation: z.boolean().optional(),
});
const ProcessInputSchema = z.object({
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

const EvalNodeScriptInputSchema = NodeCliInputSchema.merge(ProcessInputSchema).extend({
  code: z.string(),
});
const RunNodeFileInputSchema = NodeCliInputSchema.merge(ProcessInputSchema).extend({
  file: z.string(),
  args: z.array(z.string()).optional(),
});
const NodeProcessOutputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int(),
});
const wrapNodeProcess = async (nodeProgram: ChildProcessWithoutNullStreams) => {
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  nodeProgram.stdout.on("data", (data) => {
    stdout += data;
  });
  nodeProgram.stderr.on("data", (data) => {
    stderr += data;
  });
  await new Promise<void>((cb) => {
    nodeProgram.once("exit", (code) => {
      exitCode = code ?? 0;
      cb();
    });
  });
  return {stdout, stderr, exitCode};
};

export const nodejsToolsets = {
  node_run_file: createTool({
    id: "node_run_file",
    description: "Execute the nodejs script file",
    inputSchema: RunNodeFileInputSchema,
    outputSchema: NodeProcessOutputSchema,
    execute: ({context}: {context: z.TypeOf<typeof RunNodeFileInputSchema>}) => {
      const nodeProcess = spawn("node", [context.file, ...(context.args ?? [])], {
        cwd: context.cwd,
        env: context.env,
        stdio: "pipe",
      });

      return wrapNodeProcess(nodeProcess);
    },
  }),
  node_eval_code: createTool({
    id: "node_eval_code",
    description: "Evaluate the nodejs code",
    inputSchema: EvalNodeScriptInputSchema,
    outputSchema: NodeProcessOutputSchema,
    execute: ({context}: {context: z.TypeOf<typeof EvalNodeScriptInputSchema>}) => {
      const nodeProcess = spawn("node", ["-e", context.code], {
        cwd: context.cwd,
        env: context.env,
        stdio: "pipe",
      });
      return wrapNodeProcess(nodeProcess);
    },
  }),
} satisfies ToolsInput;
