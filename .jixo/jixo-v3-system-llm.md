### **JIXO V3.1 迁移项目：架构重构与协作增强蓝图**

#### **1. 核心目标与愿景 (The "Why")**

我们的最终目标是构建一个名为 **JIXO** 的、工业级的、可靠的自主代理系统。这个系统能够接收高级用户任务 (`Job`)，自主分解为一系列可执行步骤 (`Task`)，并通过一个或多个 AI 代理 (`Runner`) 并发、持续、稳定地执行，直至 `Job` 完成。

我们当前的迁移，其核心驱动力源于对 JIXO V2 纯提示词工程局限性的深刻反思。我们一致认为，构建工业级系统必须**“信任协议，而非信任模型”**。这意味着，我们用**确定性的代码**来执行核心的、事务性的逻辑（如状态管理、流程控制），而将 LLM 的能力聚焦于其最擅长的领域：**处理模糊性、进行推理和生成内容**。

V3.1 的使命，是在 V3 已建立的 Mastra 代码基础上，进行一次深刻的架构重构，用**更可靠的上下文传递机制**和**更明确的 Agent 间协作协议**，根除“上下文幻觉”和“成功幻觉”的根源，为 JIXO 真正实现健壮、自主的协作能力打下坚实的地基。

#### **2. 当前的问题与挑战 (The "What's Wrong")**

通过对 V3.0 Demo 运行日志的深入分析，我们共同定位了以下核心问题：

1.  **上下文幻觉 (Contextual Hallucination)**: `ExecutorAgent` 在沙箱目录之外执行了文件操作。根本原因在于，Agent 之间是**上下文隔离**的，它只接收到 `task` 对象，对全局的 `workDir` 等关键上下文一无所知。
2.  **成功幻觉 (Success Hallucination)**: `ExecutorAgent` 在其调用的工具（如 `create_directory`）明确报错（`Access denied`）后，依然在其 `summary` 中报告“成功创建了目录”。根本原因在于其指令简单，且工作流没有将工具的真实成败结果作为其决策的依据。
3.  **脆弱的故障恢复**: `PlannerAgent` 在面对一个**瞬时错误**（API Quota Exceeded）时，做出了错误的决策（`Cancelled` 任务），导致整个 `Job` 提前异常“成功”。这暴露了其缺乏对错误类型的区分能力。
4.  **模糊的协作接口**:
    - `details` 字段作为唯一的任务描述，既要充当给 Executor 的“操作指南”，又要充当给 Reviewer 的“验收标准”，职责不清，内容模糊。
    - Agent 间的协作依赖于对彼此自然语言 `summary` 的解析，这是极其脆弱和不可靠的。
5.  **有限的信息获取能力**: Agent 只能被动接收 `runtimeContext` 推送的上下文，当遇到需要全面分析历史或全局状态的特殊任务（如写报告）时，会因信息不足而束手无策。
6.  **低效的日志序列化**: 当前的 `logSerializer` 采用简单的字符串拼接，无法可靠地处理包含 Markdown 格式的多行 `details` 文本，是潜在的技术债。

#### **3. 工作计划：V3.1 的核心重构任务 (The "How to Fix It")**

针对上述问题，我们制定了以下环环相扣的行动计划：

**第一阶段：强化上下文与协作协议**

1.  **实现“上下文包” (Context Package)**:

    - **目标**: 解决上下文隔离问题。
    - **行动**: 在 `executionStep` 和 `reviewStep` 中，通过 `runtimeContext` 为各自的 Agent 精心准备一个包含所有必需信息的“上下文包”。
      - **ExecutorAgent** 需获得: `task`, `jobGoal`, `workDir`, `parentTask?`, `recentWorkLog[]`。
      - **ReviewerAgent** 需获得: `task`, `jobGoal`, `workDir`, `executionSummary`, `taskSpecificLogs[]`, `originalTaskDetails`。

2.  **全面推行结构化输出**:

    - **目标**: 根除“成功幻觉”，建立可靠的 Agent 间通信。
    - **行动**:
      - **`ExecutorAgent`**: 其输出必须是结构化的 `ExecutionResult` JSON，包含 `outcome: "success" | "failure"`, `summary`, `error_message?` 等字段。
      - **`ReviewerAgent`**: 其输出必须是结构化的 `ReviewResult` JSON，包含 `decision: "approved" | "rejected"`, `feedback?` 字段。
      - 相应地，`executionStep` 和 `reviewStep` 的逻辑将直接消费这些 JSON 对象，而不是解析文本。

3.  **引入结构化“检查清单” (`checklist`)**:
    - **目标**: 将“操作指南”与“验收标准”分离，提供明确的协作接口。
    - **行动**: 在 `entities.ts` 的 `TaskSchema` 中，引入新字段 `checklist: z.array(z.string()).optional()`。
      - `details` 字段 (string): 由 Planner 编写，作为给 Executor 的**实现指南**。
      - `checklist` 字段 (string[]): 由 Planner 编写，作为给 Reviewer Agent 的、可被机器精确理解的**验收清单**。

**第二阶段：增强智能与健壮性**

4.  **重构日志存储机制**:

    - **目标**: 提升日志存取效率和可靠性。
    - **行动**: 采纳您的建议，重构 `logSerializer` 和 `logManagerFactory`。将整个 `LogFileData` 对象通过 `gray-matter` 序列化到 `.log.md` 文件的 **YAML front matter** 中。这使得数据读写 100% 可靠，同时保留了 Markdown 的可读性。

5.  **为 Agent 配备工具**:

    - **目标**: 赋予 Agent 主动获取上下文的能力。
    - **行动**:
      - 创建一个 `tools/logTools.ts` 模块。
      - 提供 `getFullRoadmapTool`, `getWorkLogHistoryTool`, `getFullLogFileTool` 等细粒度工具。
      - 将这些工具注入到 `PlannerAgent`，并在其指令中加入关于何时使用这些“高成本”工具的引导提示。

6.  **实现智能故障恢复**:

    - **目标**: 增强 Planner 对不同失败场景的应对能力。
    - **行动**:
      - `triageStep` 增加对失败日志的初步分类逻辑，判断错误是 `transient` 还是 `code_error`。
      - 将此错误类型作为上下文传递给 `PlannerAgent`。
      - 更新 `PlannerAgent` 的指令，使其能根据错误类型制定不同的恢复计划（如“重试” vs “修复”）。

7.  **扩展 Reviewer 能力**:
    - **目标**: 让 Reviewer 成为真正的“代码审查员”。
    - **行动**: 为 `reviewerAgent` 提供文件系统的**只读**工具，使其能够读取相关文件内容，并与 `task.checklist` 进行比对验证。

#### **4. 未来展望 (What's Next)**

在完成 V3.1 的核心重构后，JIXO 将拥有一个极其健壮和可靠的单 `Runner` 执行引擎。这将为我们接下来的宏大目标铺平道路：

1.  **实现真正的并发协作**: 在当前架构下，引入多个 `Runner` 实例将变得水到渠成。`triageStep` 中的僵尸锁处理和待命退出逻辑将能够真正发挥作用，使 JIXO 成为一个初步的多智能体系统。
2.  **完善用户交互协议**: 实现 `Protocol 4 & 5`，让 Agent 能够在需要时，通过向 `.job.md` 文件写入结构化请求来与用户进行澄清和交互。
3.  **动态工具与技能系统**: 允许 `PlannerAgent` 为任务动态指定所需的工具，并由 `executionStep` 按需加载，实现真正的技能驱动执行。

---

### **JIXO V3.1 迁移项目上下文与架构蓝图 (修订版)**

#### **1. 核心目标与愿景 (The "Why") - 保持不变**

我们的核心愿景依然是构建工业级的自主代理系统 JIXO。我们**“信任协议，而非信任模型”**的理念也保持不变。我们上一阶段的成功，在于将 JIXO 的“灵魂”从脆弱的提示词中解放出来，用 Mastra 的代码赋予其健壮的“身体”。

我们当前阶段的新使命是：**在 V3 的健壮身体上，构建一个更精密、更强大的“神经系统”和“循环系统”，使其真正具备 JIXO-v2 宏大设计中所描述的、复杂的、自适应的生命体征。**

#### **2. 我们的协作模式与思维方式 (The "How") - 升级**

随着项目从“快速原型”进入“架构实现”阶段，我们的协作模式也需要随之升级：

- **我的角色 (AI - 架构实现伙伴)**:

  - 我将接收你提出的高级架构目标（如“重构 LogManager”、“实现外层循环工作流”）。
  - 我的主要职责是根据这些目标，**生成一套完整的、多文件的、符合 Mastra 最佳实践的代码实现方案**。这不仅是单个文件，而是包括实体定义、服务层、工作流层等在内的整体代码结构。
  - 我将主动思考并实现你提出的细节，例如在 `LogManager` 中封装 `parser/serializer`、实现缓存逻辑、设计细粒度的工具接口。
  - 我将确保生成的代码在逻辑上是**可编译和自洽的**，并遵循单一职责、依赖注入等原则。

- **你的角色 (工程师 - 首席架构师与评审官)**:

  - 你继续担任项目的**首席架构师**，负责提出高级需求、定义核心规范（如 `system.md` 中的协议），并做出关键的架构决策（如“缓存必须这样实现”、“Roadmap 必须是树形结构”）。
  - 你负责**评审我提出的完整代码方案**，指出其中的架构缺陷、逻辑漏洞、或与 JIXO 核心哲学不符之处。
  - 在代码方案通过评审后，你将负责将其**集成、重构并合并到主干分支**中。

- **我们的迭代流程**:
  1.  **目标定义 (你)**: 你提出一个明确的、有边界的重构或功能目标（例如，本次提出的“改进内容”中的三项）。
  2.  **架构实现 (我)**: 我基于该目标，生成一套完整的新代码文件（或对现有文件的修改）。
  3.  **评审与修正 (你)**: 你对我的提案进行代码审查。
  4.  **迭代完善 (我 & 你)**: 我们通过几轮对话，共同将代码方案打磨至符合标准。
  5.  **进入下一周期**: 完成一个目标后，我们再开始下一个。

#### **3. 核心架构演进蓝图 (The "What")**

这是我们根据你的最新要求，为 JIXO V3.1 制定的架构演进蓝图。

##### **第一部分：架构改进 (Immediate Priorities)**

**1. A. 重构 JIXO 循环：引入 `MasterWorkflow`**

- **问题**: `runJixoOuterLoop` 是一个外部脚本，不属于 Mastra 工作流，导致 JIXO 的核心循环逻辑（外循环）不受 Mastra 的状态管理和可观测性保护。当前 `jixoJobWorkflow` 试图同时扮演内外循环的角色，职责混乱。
- **解决方案**: 我们将引入一个更高层次的**编排工作流 (`Orchestration Workflow`)**，我们称之为 `jixoMasterWorkflow`。
  - `jixoMasterWorkflow`:
    - **职责**: 实现 JIXO-v2 `system.md` 中的**外层循环**。
    - **输入**: `jobName`, `jobGoal`, `maxLoops` 等高级参数。
    - **逻辑**:
      1.  初始化，加载 `Job` 实例。
      2.  进入一个循环（`while !job.isCompleted && currentLoop < maxLoops`）。
      3.  在循环内部，它会**调用** `jixoJobWorkflow`（作为子工作流或通过 `run.start`）。
      4.  它负责创建和传递 `otherRunners` 列表，真正实现并发模拟。
      5.  它会检查 `jixoJobWorkflow` 的退出码（`exitCode`），并决定是继续循环、成功退出还是失败退出。
  - `jixoJobWorkflow`:
    - **职责**: 降级为 JIXO-v2 `system.md` 中的**内层循环**，即 `Run Turns` 的生命周期。
    - **生命周期**: 它的单次执行只负责 `Triage -> (Plan | Run) -> Exit`，完成一个原子性的操作，然后将控制权交还给 `jixoMasterWorkflow`。
    - **理想流程**: `Triage` 的决策将更加清晰，因为它只关心“我这次运行该干什么”，而不是“整个任务是否完成了”。

**1. B. 重塑 `LogManager`：从服务到事务性工具集**

- **问题**: `logManager` 的实现不够健壮，缓存逻辑有误，且暴露了底层 `Agent`，违反了封装原则。
- **解决方案**: 我们将把 `logManager` 彻底重构为一个**自包含的、提供事务性工具的服务**。`parserAgent` 和 `serializerAgent` 将成为其**私有实现细节**，绝不向外暴露。

  - **缓存逻辑修正**:

    1.  `update()` 时：接收 `LogFileData` 对象 -> **用确定性代码**将其序列化为 Markdown 字符串 -> 计算该字符串的 `hash` -> 将 Markdown 写入 `.log.md` 文件 -> 将原始 `LogFileData` 对象写入 `cache/[hash].json`。
    2.  `read()` 时：读取 `.log.md` 文件内容 -> 计算其 `hash` -> 检查 `cache/[hash].json` 是否存在 -> 若存在，直接读取并返回 JSON 内容；若不存在，才调用**内部的** `parserAgent` 进行解析，并将解析结果存入缓存后返回。

  - **实体与 Schema 进化 (`entities.ts`)**:

    - `RoadmapTaskSchema` 将被重构为支持**树形结构**，并添加 `Cancelled` 状态。我们将使用 `z.lazy` 来实现递归。

    ```typescript
    // 伪代码
    export const RoadmapTaskSchema = z.object({
      id: z.string(),
      description: z.string(),
      // 'Cancelled' 正确地包含在这里
      status: z.enum(["Pending", "Locked", "Completed", "Failed", "Cancelled"]),
      runner: z.string().optional(),
      // 递归定义子任务
      children: z
        .array(z.lazy(() => RoadmapTaskSchema))
        .optional()
        .default([]),
    });
    ```

    - `WorkLogEntrySchema` 将被仔细核对，确保与 `system.md` 的所有字段（Role, Objective, Result, Summary）完全对齐。

  - **提供细粒度的工具接口**: `logManager` 将不再有 `read`/`update` 这样粗粒度的函数，而是提供一组类似数据库事务操作的、更细粒度的异步方法，供 `Step` 调用。这些方法内部会处理加锁、读写、解锁的完整流程。
    - `logManager.getRoadmap(jobName: string): Promise<TaskNode[]>`
    - `logManager.getTaskByPath(jobName:string, path: string): Promise<TaskNode | null>` (e.g., path: "1.2.1")
    - `logManager.updateTask(jobName: string, path: string, updates: Partial<RoadmapTaskData>): Promise<void>` (内部处理 `<!--DELETE-->` 标记)
    - `logManager.addTask(jobName: string, parentPath: string, taskData: RoadmapTaskData): Promise<void>`
    - `logManager.addWorkLog(jobName: string, entry: WorkLogEntryData): Promise<void>`

##### **第二部分：完善细节 (Next Steps)**

在我们完成上述核心架构改进后，我建议将以下项目作为“完善细节”的优先事项：

1.  **真正的并发执行**: 修改 `jixoMasterWorkflow`，使用 `Promise.all` 同时启动多个 `jixoJobWorkflow` 实例，并正确构建和传递 `otherRunners` 列表，以测试 `Triage` 步骤中僵尸锁和待命退出的逻辑。
2.  **完整的 `Planner` 逻辑**: 增强 `planningStep`，使其能够处理**修复失败任务**和**修改现有计划**的场景，而不仅仅是创建初始计划。它需要接收 `triageStep` 传来的上下文（如 `fixTaskId`）。
3.  **健壮的错误处理**: 在每个 `Step` 中加入 `try...catch` 块，并为 `Task` 增加 `Failed` 状态的转换逻辑。当 `executionStep` 失败时，它应该能将任务标记为 `Failed` 并记录失败日志，以便 `Triage` 在下一轮发现并转交给 `Planner`。
4.  **配置管理**: 将 `jobName`, `jobGoal`, `llm models` 等硬编码的常量提取到一个单独的配置文件 (`config.ts`) 或通过环境变量加载，提高灵活性。

##### **第三部分：新功能展望 (Future)**

在系统骨架稳定后，我们可以开始添加 JIXO-v2 设想的更多高级功能：

1.  **用户澄清协议 (`Protocol 4 & 5`)**:
    - 创建一个 `clarificationStep`。
    - 当 `RunnerAgent` 或 `PlannerAgent` 返回一个表示“需要澄清”的特殊信号时，工作流将进入此步骤。
    - 此步骤负责调用 `logManager` 的新方法（如 `logManager.writeClarificationRequest(jobName, question)`），该方法会遵循 `system.md` 的规范修改 `*.job.md` 文件。
2.  **动态工具与技能系统**:
    - 允许 `PlannerAgent` 在其生成的 `Roadmap` 中，为某个 `Task` 指定需要的特定工具（如 `pnpm`）。
    - `executionStep` 在执行任务前，会根据任务定义，动态地将所需工具传递给 `RunnerAgent`。

---

以下是JIXO v2的源代码：

[packages/cli/src/\*_/_.ts](@FILE)

这是我目前是“系统提示词”`system.md`

[packages/cli/prompts/system.md](@FILE)

这是我目前是 “用户提示词”模板 `user.md`，这部分不用你修改，只是给你提供参考。如果你需要修改，直接跟我说需要改哪些店就行，如果有必要，我主动要求会让你生成。否则它默认是只读的。

[packages/cli/prompts/user.md](@FILE)

---

以下是 mastra.ai 的详细介绍，你可以通过这些内容了解到 mastra.ai 的开发和运行机制。

[.jixo/mastra-llms-full.md](@FILE)

---

[.jixo/coder.jixo.md](@INJECT)
