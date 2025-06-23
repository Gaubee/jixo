import {createTool} from "@mastra/core";
import type {ToolsInput} from "@mastra/core/agent";
import {spawn} from "node:child_process";
import {match} from "ts-pattern";
import z from "zod";

const RunNodeInputSchema = z.object({
  args: z.union([
    z.object({
      mode: z.literal("eval"),
      code: z.string(),
    }),
    z.object({
      mode: z.literal("file"),
      file: z.string(),
      args: z.array(z.string()).optional(),
    }),
  ]),
  cwd: z.string().optional(),
});
const RunNodeOutputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int(),
});
export const nodejsToolsets = {
  run_node: createTool({
    id: "run_node",
    description: "Run a node command",
    inputSchema: RunNodeInputSchema,
    outputSchema: RunNodeOutputSchema,
    execute: async ({context}: {context: z.TypeOf<typeof RunNodeInputSchema>}) => {
      const nodeProgram = await match(context.args)
        .with({mode: "eval"}, (evalContext) => {
          return spawn("node", ["-e", evalContext.code], {cwd: context.cwd, stdio: "pipe"});
        })
        .with({mode: "file"}, (fileContext) => {
          return spawn("node", [fileContext.file, ...(fileContext.args ?? [])], {cwd: context.cwd, stdio: "pipe"});
        })
        .exhaustive();
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
    },
  }),
} satisfies ToolsInput;
