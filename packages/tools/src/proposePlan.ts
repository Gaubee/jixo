import z from "npm:zod";

export const name = "proposePlan";

export const description = "在执行复杂的、涉及多个步骤或文件的任务前，调用此工具来向用户提出一个高层级的行动计划以供审批。这强制执行了“规划-执行”两阶段流程。";

export const paramsSchema = z.object({
  plan_summary: z.string().describe("对整个计划的一句话总结。"),
  steps: z.array(z.string()).describe("一个有序列表，描述了计划执行的每一个具体步骤。"),
  estimated_tool_calls: z.array(z.string()).optional().describe("预估在计划批准后将会调用的主要工具列表，例如['submitChangeSet', 'runShellCommand']。"),
});

/**
 * 这是一个模拟的functionCall实现。
 * 在实际应用中，这里可能会将计划展示给用户并等待用户的批准。
 * @param args - 符合paramsSchema的参数
 * @returns 一个表示计划已收到并等待批准的对象
 */
export const functionCall = (args: z.infer<typeof paramsSchema>) => {
  console.log("Proposing plan with args:", args);

  // 模拟返回一个待批准的状态
  const result = {
    status: "PLAN_PROPOSED",
    message: "Plan has been received and is pending user approval.",
    plan: args,
  };

  console.log("Execution result:", result);
  return result;
};

// JIXO_CODER_EOF
