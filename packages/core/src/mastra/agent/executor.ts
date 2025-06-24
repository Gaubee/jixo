import {YAML} from "@gaubee/nodekit";
import type {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {type RuntimeContext} from "@mastra/core/runtime-context";
import {Memory} from "@mastra/memory";

import {commonModel} from "../llm/index.js";
import {tools} from "../tools/index.js";
import type {ExecutorRuntimeContextData} from "../workflows/schemas.js";
import type {CreateAgentOptions} from "./common.js";
import {ExecutionResultSchema} from "./schemas.js";

export const createExecutorAgent = async ({workDir, memoryStorage}: CreateAgentOptions) => {
  const executorAgent = new Agent({
    name: "ExecutorAgent",
    instructions: `
You are a diligent and precise software engineer. Your SOLE purpose is to execute a given task by calling tools.

### CRITICAL Directives:
1.  **MANDATORY Tool Use**: You **MUST** call tools to accomplish the task's objectives. You are an executor, not a reporter. For example, if the task is "create a file", you **MUST** call the \`fs_write_file\` tool. Simply returning a success message without calling a tool is a direct violation of your core protocol.
2.  **Environment**: You operate within a specific working directory. All file paths provided to tools MUST be relative to that directory.
3.  **Error Handling**: If ANY tool call returns an error, you MUST stop immediately. Your final output's "outcome" field must be "failure", and the "errorMessage" field must contain the exact error message from the tool.
4.  **Successful Execution**: If all tool calls to complete the task are successful, the "outcome" field must be "success".
5.  **Summarization**: Your "summary" must be a concise, one-sentence statement of the actions you **actually performed** (i.e., the tools you called).

Your final output MUST be a JSON object.`,
    model: commonModel,
    memory: new Memory({
      options: {
        workingMemory: {
          enabled: true,
        },
      },
    }),
    tools: {
      ...(await tools.fileSystem(workDir)),
      ...(await tools.pnpm()),
      ...(await tools.git(workDir)),
      ...tools.node,
    },
  });

  return executorAgent;
};

export type ExecutorAgent = Awaited<ReturnType<typeof createExecutorAgent>>;

export const useExecutorAgent = async (mastra: Mastra, args: {runtimeContext: RuntimeContext<ExecutorRuntimeContextData>}) => {
  const {runtimeContext} = args;
  const logManager = runtimeContext.get("logManager");
  const task = runtimeContext.get("task");
  const recentWorkLog = runtimeContext.get("recentWorkLog");
  const gitCommit = runtimeContext.get("gitCommit");
  const jobInfo = logManager.getJobInfo();
  const cwd = jobInfo.workDir;

  const recentLogsText = [
    `### Recent Activity (for context):`,
    recentWorkLog && recentWorkLog.length > 0
      ? [
          //
          "```yaml",
          YAML.stringify(task.details),
          "```",
        ]
      : "_No recent activity._",
  ]
    .flat()
    .join("\n");

  const gitCommitInstruction = gitCommit
    ? `
---
### Git Commit Requirement
After successfully completing all steps, you MUST perform a Git commit.
- Use the 'git_commit' tool.
- The commit message must follow the Conventional Commits specification.
- The message format like: 'feat(task-${task.id}): ${task.title}\\n\\n<your one-sentence summary>'.`
    : "";

  /// 用户提示词
  const userPrompt = `
Current Working Directory: \`${cwd}\`

${recentLogsText}

---

### Your Current Task
**ID**: ${task.id}
**Title**: ${task.title}
**Details**:
${
  task.details && task.details.length > 0
    ? [
        //
        "",
        "```yaml",
        YAML.stringify(task.details),
        "```",
      ].join("\n")
    : "_No details provided._"
}

---

${gitCommitInstruction}
`;

  return mastra.getAgent("executorAgent").generate([{role: "user", content: userPrompt}], {
    output: ExecutionResultSchema,
    runtimeContext,
  });
};
