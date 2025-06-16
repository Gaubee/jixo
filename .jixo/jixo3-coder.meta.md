感谢，我已经review并合并了你的代码。

以下是最新代码：

[`next/src/**/*.ts`](@FILE)

接下来，我们就按照你之前的计划接着完善我们的代码吧。

### **新的计划：赋予 Planner “编辑”和“取消”的权力，完成真正的动态规划**

目前，我们的`Planner`在响应“返工”或“修复”时，能力还比较单一：它只能**添加**新的子任务。

但一个真正高级的规划者，在面对复杂情况时，应该拥有更强大的能力。比如：

- 当一个任务失败时，`Planner`可能会认为这个任务本身的设计就有问题，它应该被**取消**，并由两个全新的、不相关的任务来替代。
- 当一个任务需要返工时，`Planner`可能只需要**修改**原任务的`details`或`description`，而不需要添加新的子任务。

因此，我提议我们的下一个核心任务是：**升级`PlannerAgent`及其输出协议，使其具备对路线图进行“增、删、改”的完整动态规划能力。**

---

### **新版具体行动计划**

为了实现这个目标，我们需要进行以下三步核心改造：

**1. 增强 `Planner` 的输出协议 (`agent/schemas.ts`)**

- **目标**: 让 Planner 的输出从单一的“添加任务列表”变为一个包含多种操作的“指令集”。
- **行动**: 我们将修改 `PlannerOutputSchema`。它不再只有一个 `tasks` 字段，而是变成一个包含多个可选操作字段的对象：
  ```typescript
  // agent/schemas.ts (伪代码)
  export const PlannerOutputSchema = z.object({
    add: z.array(NewTaskSchema).optional().describe("在此处添加全新的任务或子任务。"),
    update: z
      .array(
        z.object({
          id: z.string(),
          changes: z.object({
            /* ... updatable fields ... */
          }),
        }),
      )
      .optional()
      .describe("在此处更新现有任务的字段。"),
    cancel: z.array(z.string()).optional().describe("在此处通过任务ID列表来取消现有任务。"),
  });
  ```

**2. 升级 `plannerAgent` 的智能 (`agent/planner.ts`)**

- **目标**: 教会 `PlannerAgent` 如何使用这个功能更强大的新“武器”。
- **行动**: 我将大幅更新 `plannerAgent` 的`instructions`。
  - 明确告诉它现在可以输出一个包含`add`, `update`, `cancel`三个指令的JSON对象。
  - 为每个场景提供更丰富的示例。例如：“当修复任务'1.2'的失败时，你可以决定取消它（`cancel: ['1.2']`），并添加两个新的根任务（`add: [{...}, {...}]`）来替代它。”

**3. 重构 `planningStep` 以执行指令集 (`workflows/jixoJobWorkflow.ts`)**

- **目标**: 让`planningStep`成为一个真正的“指令执行引擎”。
- **行动**: `planningStep`的逻辑将变得更加精密。
  - 在从`plannerAgent`获取到结构化的`result.object`后，它不再是简单地遍历一个列表。
  - 它将按逻辑顺序（例如，先`cancel`，再`update`，最后`add`）检查`result.object`中的每个指令数组。
  - 如果数组存在，它将遍历该数组，并调用`logManager`中对应的`updateTask`或`addTask`方法来执行每一个具体操作。
