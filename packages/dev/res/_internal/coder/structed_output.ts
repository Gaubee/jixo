import {z} from "zod";

// =============================================================================
// 1. 定义嵌套的、可复用的子 Schema
// =============================================================================

const ActionMapSchema = z
  .object({
    mode: z.enum(["精确输出", "范围输出", "螺旋前进"]).describe("宣告本次多轮响应遵循的模式。"),
    steps: z.array(z.string()).optional().describe("当 mode 为 '精确输出' 时使用，提供一个有序的步骤列表。"),
    mermaid_flowchart: z.string().optional().meta({
      description: "当 mode 为 '范围输出' 或 '螺旋前进' 时使用，提供一个Mermaid流程图。",
      format: "multiline",
    }),
  })
  .loose() // 允许额外属性，避免生成 additionalProperties: false
  .describe("【行动地图】预告后续响应的计划。其内容根据'mode'的值而变化。")
  .refine(
    (data) => {
      if (data.mode === "精确输出") return data.steps !== undefined;
      if (data.mode === "范围输出" || data.mode === "螺旋前进") return data.mermaid_flowchart !== undefined;
      return false;
    },
    {message: "根据 'mode' 的值, 'steps' 或 'mermaid_flowchart' 必须提供一个。"},
  );

const FileOperationSchema = z
  .object({
    summary: z.array(z.string()).describe("以列表形式清晰、简要地说明该文件的核心改动点。"),
    action: z.enum(["UPDATE", "DELETE", "RENAME"]).describe("对文件的具体操作类型。"),
    new_path: z.string().optional().describe("当 'action' 为 'RENAME' 时必须提供此字段，表示文件的新路径。"),
    content: z.string().optional().meta({
      description: "文件的完整内容。当 'action' 为 'UPDATE' 或 'RENAME'(且带内容修改) 时提供。对于 'DELETE' 则省略。",
      format: "multiline",
    }),
  })
  .describe("描述对单个文件的具体操作。")
  .loose() // 允许额外属性
  .refine(
    (data) => {
      if (data.action === "RENAME") return data.new_path !== undefined;
      if (data.action === "UPDATE") return data.content !== undefined;
      return true;
    },
    {message: "根据 'action' 的值, 'new_path' 或 'content' 可能为必需项。"},
  );

const MultiStepProgressSchema = z
  .object({
    is_complete: z.boolean().describe("标识所有步骤是否已完成。"),
    // 使用 .meta({ type: "integer" }) 替代 .int() 来避免 min/max
    current_step: z.number().optional().meta({
      type: "integer",
      description: "当前完成的是第几步。当 is_complete 为 false 时提供。",
    }),
    total_steps: z.number().optional().meta({
      type: "integer",
      description: "计划的总步数。当 is_complete 为 false 时提供。",
    }),
  })
  .describe("在多轮响应中用于流程控制的结构化信号。此字段为可选。")
  .loose() // 允许额外属性
  .refine(
    (data) => {
      if (data.is_complete === false) {
        return data.current_step !== undefined && data.total_steps !== undefined;
      }
      return true;
    },
    {message: "当 is_complete 为 false 时, 'current_step' 和 'total_steps' 是必需的。"},
  );

// =============================================================================
// 2. 将所有属性定义在一个大的 z.object 中
// =============================================================================

const jixoAiCoderResponse = z
  .object({
    response_type: z
      .enum(["PROGRAMMING_INITIAL_PLAN", "PROGRAMMING_DELIVERY", "PLANNING_PRD", "PLANNING_AUDIT_REPORT", "REFLECTION"])
      .describe("标识本次响应的核心类型，用于区分不同协作模式下的输出内容。"),

    reflection_log: z
      .array(z.string().describe("单条反思记录，通常以Emoji开头，总结一个或一组改动点。"))
      .optional()
      .describe("【反思日志】在收到代码审查反馈后提供的反思。此字段为可选。"),

    initial_plan_payload: z
      .object({
        change_log: z.string().describe("【变更日志】严格遵守Git Commit Message规范，以用户（第一人称）口吻编写。"),
        action_map: ActionMapSchema,
      })
      .loose()
      .optional()
      .describe("当 response_type 为 'PROGRAMMING_INITIAL_PLAN' 时使用。包含变更日志和行动地图。"),

    delivery_payload: z
      .object({
        opening_remark: z.string().optional().describe("简要说明本次交付内容的开场白。"),
        file_changes: z
          .array(
            z
              .object({
                path: z.string().describe("被操作文件的完整路径。"),
                operation: FileOperationSchema,
              })
              .describe("代表对单个文件的变更操作，包含文件路径和具体操作。")
              .loose(),
          )
          .describe("一个包含所有文件变更的数组。"),
      })
      .loose()
      .optional()
      .describe("当 response_type 为 'PROGRAMMING_DELIVERY' 时使用。包含具体的文件变更。"),

    planning_prd_payload: z
      .object({
        prd_document: z.string().meta({
          description: "PRD文档。", // 原始JSON中没有description，但diff显示有，这里保持和diff一致
          format: "markdown",
        }),
      })
      .loose()
      .optional()
      .describe("当 response_type 为 'PLANNING_PRD' 时使用。包含PRD文档。"),

    audit_report_payload: z
      .object({
        audit_report: z.string().meta({
          description: "代码审计报告。", // 同上
          format: "markdown",
        }),
      })
      .loose()
      .optional()
      .describe("当 response_type 为 'PLANNING_AUDIT_REPORT' 时使用。包含代码审计报告。"),

    export_memory_payload: z
      .object({
        path: z.string().meta({
          description: "记忆文件导出的目标路径。通常约定为'.jixo/memory'目录下的一个markdown文件。",
          example: ".jixo/memory/xx.meta/2025-08-08.01.{prd,checkpoint,skill,...}.md",
        }),
        content: z.string().meta({
          description: "串联了对话和思考过程的完整研发报告内容。",
          format: "markdown",
        }),
      })
      .loose()
      .optional()
      .describe("在多轮交付的最后一轮，用于导出包含“研发报告”的记忆文件。此字段为可选。"),

    multi_step_progress: MultiStepProgressSchema.optional(),
  })
  .loose() // 顶级对象也需要
  .superRefine((data, ctx) => {
    switch (data.response_type) {
      case "PROGRAMMING_INITIAL_PLAN":
        if (!data.initial_plan_payload) ctx.addIssue({code: z.ZodIssueCode.custom, message: "initial_plan_payload is required.", path: ["initial_plan_payload"]});
        break;
      case "PROGRAMMING_DELIVERY":
        if (!data.delivery_payload) ctx.addIssue({code: z.ZodIssueCode.custom, message: "delivery_payload is required.", path: ["delivery_payload"]});
        break;
      case "PLANNING_PRD":
        if (!data.planning_prd_payload) ctx.addIssue({code: z.ZodIssueCode.custom, message: "planning_prd_payload is required.", path: ["planning_prd_payload"]});
        break;
      case "PLANNING_AUDIT_REPORT":
        if (!data.audit_report_payload) ctx.addIssue({code: z.ZodIssueCode.custom, message: "audit_report_payload is required.", path: ["audit_report_payload"]});
        break;
    }
  })
  .describe("定义了AI软件工程师与架构师伙伴的完整响应结构。根据'response_type'的值，会选择性地填充对应的载荷字段。");

// =============================================================================
// 3. 导出 Schema 和类型
// =============================================================================

// 注意：z.toJSONSchema 会默认添加 $schema 属性
const jixoAiCoderResponseJsonSchema = z.toJSONSchema(jixoAiCoderResponse, {});

export default jixoAiCoderResponseJsonSchema;

export type JixoAiCoderResponse = z.infer<typeof jixoAiCoderResponse>;
