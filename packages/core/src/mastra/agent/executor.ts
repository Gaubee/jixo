import {YAML} from "@gaubee/nodekit";
import type {Mastra} from "@mastra/core";
import {Agent} from "@mastra/core/agent";
import {type RuntimeContext} from "@mastra/core/runtime-context";
import {commonModel} from "../llm/index.js";
import {tools} from "../tools/index.js";
import type {ExecutorRuntimeContextData} from "../workflows/schemas.js";
import {ExecutionResultSchema} from "./schemas.js";

export const createExecutorAgent = async (dir: string) => {
  const executorAgent = new Agent({
    name: "ExecutorAgent",
    instructions: `You are a diligent software engineer operating in a sandbox environment.
- You will be given a task to execute with a specific working directory. ALL file operations MUST use relative paths from that directory.
- Execute the task step-by-step using the provided tools.
- If instructed, after a successful execution, you MUST perform a git commit using the provided tools.
- **CRITICAL**: If any tool returns an error, you MUST stop immediately. Your final output's "outcome" field must be "failure", and the "errorMessage" field must contain the error message from the tool.
- If all steps are successful, the "outcome" field must be "success".
- Your "summary" must be a concise, one-sentence statement of the work you performed, focusing on the outcome.

Your final output MUST be a JSON object.`,
    model: commonModel,
    tools: {
      ...(await tools.fileSystem(dir)),
      ...(await tools.pnpm()),
      ...(await tools.git()),
    },
  });

  return executorAgent;
};

export const useExecutorAgent = async (mastra: Mastra, args: {runtimeContext: RuntimeContext<ExecutorRuntimeContextData>}) => {
  const {runtimeContext} = args;
  const logManager = runtimeContext.get("logManager");
  const task = runtimeContext.get("task");
  const recentWorkLog = runtimeContext.get("recentWorkLog");
  const gitCommit = runtimeContext.get("gitCommit");
  const jobInfo = logManager.getJobInfo();
  const cwd = jobInfo.workDir;

  const recentLogsText =
    recentWorkLog && recentWorkLog.length > 0
      ? `### Recent Activity (for context):
${recentWorkLog.map((log) => `- [${log.role}] ${log.summary}`).join("\n")}`
      : "### Recent Activity (for context):\nNo recent activity.";

  const gitCommitInstruction = gitCommit
    ? `
---
### Git Commit Requirement
After successfully completing all steps, you MUST perform a Git commit.
- Use the 'git_commit' tool.
- The commit message must follow the Conventional Commits specification.
- The message format like: 'feat(task-${task.id}): ${task.title}\\n\\n<your one-sentence summary>'.`
    : "";

  const prompt = `
Current Working Directory: \`${cwd}\`

${recentLogsText}

---

### Your Current Task
**ID**: ${task.id}
**Title**: ${task.title}
**Details**:
${task.details ? ["```yaml", YAML.stringify(task.details), "```"].join("\n") : "_No details provided._"}
${gitCommitInstruction}
`;

  return mastra.getAgent("executorAgent").generate(prompt, {
    output: ExecutionResultSchema,
    runtimeContext, // Tools might still need the logManager from context
    // toolsets: {
    //   fs: await tools.fileSystem(jobInfo.workDir),
    // },
  });
};
