### **JIXO V3 迁移项目上下文总结与展望**

#### **1. 核心目标与愿景 (The "Why")**

**项目愿景**:
我们的最终目标是构建一个名为 **JIXO** 的、工业级的、可靠的自主代理系统。这个系统应该能够接收高级的用户任务（`Job`），并能自主地将其分解为一系列可执行的步骤（`Tasks`），然后通过一个或多个并发的 AI 代理（`Runners`）持续、稳定地执行这些任务，直到 `Job` 完成。

**核心挑战与迁移初衷**:
我们最初尝试通过一个非常详尽、复杂的**单一系统提示词 (`system.md`)** 来约束和指导一个大语言模型（LLM）的行为，以实现 JIXO 的功能。然而，我们遇到了纯提示词工程的固有瓶颈：

1.  **AI 幻觉与协议偏离**: 尽管提示词极其严格，但 LLM 的概率性本质使其难以 100% 遵守复杂的协议，尤其是在长对话或复杂情境下。
2.  **可维护性与扩展性差**: 巨大的提示词文件难以维护、测试和扩展。任何逻辑的微小改动都可能引发不可预见的连锁反应。
3.  **状态管理的脆弱性**: 依赖 AI 来理解和操作基于文本的状态文件（`*.log.md`），使得系统的核心状态管理变得脆弱且不可靠。

**迁移到 Mastra.ai 的根本原因**:
我们一致认为，要构建一个工业级系统，必须**“信任协议，而非信任模型”**。这意味着，我们应该用**确定性的代码**来执行核心的、事务性的逻辑（如状态管理、流程控制），而将 LLM 的能力聚焦于其最擅长的领域：**处理模糊性、进行推理和生成内容**。

Mastra.ai 框架被选中，因为它提供了实现这一理念所需的核心原语：

- **工作流 (Workflows)**: 用于将复杂的 JIXO 协议（`JIXO_EXECUTION_PROTOCOL`）翻译成基于代码的、可靠的状态机。
- **步骤 (Steps)**: 将协议中的每个原子性操作（如分诊、规划、执行）封装成独立的、可测试的单元。
- **智能体 (Agents)**: 定义具有不同职责（如规划、执行、解析）的专业化 AI 角色。
- **工具 (Tools)**: 为 Agent 提供与外部世界（如文件系统）交互的、可靠的接口。

我们的任务，本质上是**将 JIXO 的“灵魂”（其双层循环、协议驱动的设计哲学）从脆弱的提示词文本中解放出来，并将其用 Mastra 的 TypeScript 代码进行重生，创造一个更健壮、更可预测、更强大的 JIXO V3**。

#### **2. 我们的协作模式与思维方式 (The "How")**

- **我的角色 (AI)**: 作为你的技术伙伴，我负责将我们的架构讨论和高级概念快速转化为具体的、可执行的 Mastra 代码原型。我倾向于遵循最佳工程实践，如单一职责、依赖注入、类型安全等，并会在代码中引入这些概念。我也会主动识别潜在的架构问题（如性能瓶颈、可靠性风险），并提出备选方案。
- **你的角色 (工程师)**: 你是 JIXO 的首席架构师和产品负责人。你提供高级的、富有洞察力的架构方向和需求（如“AI驱动的解析”、“引入实体类”），并对我的代码实现进行评审和修正。你拥有最终的决策权，并能从实践经验中指出我代码中的理论化或不切实际之处（如对 `result.result` 的错误使用）。
- **我们的协作流程**:
  1.  **讨论与决策**: 我们首先就一个高级目标（如如何管理日志）进行深入的架构讨论，权衡不同方案（如方案 A, B, B+, D）的利弊。
  2.  **原型实现**: 在达成共识后，我负责快速生成一个实现了新方案的**完整代码原型**。
  3.  **评审与修复**: 你对原型进行审查，指出编译错误或逻辑问题。
  4.  **迭代完善**: 我根据你的反馈进行修复和优化，然后我们进入下一个开发周期。
  5.  **关注点分离**: 我们达成了共识，在原型阶段将所有代码集中在一个文件中以提高迭代速度，但在代码趋于稳定时，会由你主导将其拆分到不同的模块中，以提高可维护性。

#### **3. 核心架构演进与决策细节 (The "What")**

我们已经经历了多个版本的迭代，每一次都解决了一个关键问题：

- **V1-V4 (基础搭建与类型修复)**:

  - **决策**: 我们确定了用 Mastra 的 **Workflow + Step** 来实现 JIXO 的“内层循环”协议。
  - **实现**: 搭建了基础的 `logManager`、`PlannerAgent`、`RunnerAgent` 和一个简化的 `jixoJobWorkflow`。
  - **学习**: 我们通过解决 TypeScript 的类型错误，深刻理解了 Mastra 工作流中数据是如何通过 `inputSchema` 和 `outputSchema` 精确流转的。

- **V5-V6 (日志管理的架构之争与方案D的确立)**:

  - **核心讨论**: 如何处理 `*.log.md`？是纯代码解析（方案B+），还是引入一个专门的 `LogAgent`（方案C）？
  - **你的洞见**: 你提出了**方案D**——使用 AI 进行解析和序列化，但通过**哈希缓存**来控制成本和性能。这是一个关键的、富有远见的决策。
  - **最终方案**: 我们采纳了方案 D。这使得 JIXO 的状态文件可以保持对人类友好的 Markdown 格式，同时系统内部操作的是类型安全的 JSON 对象，兼具了灵活性和健壮性。

- **V7-V8 (实体类的引入与端到端智能闭环)**:
  - **核心讨论**: 如何更好地组织和管理数据？
  - **你的建议**: 引入 `Job` 和 `Task` 实体类。
  - **实现**: 我们创建了 `Job` 和 `Task` 类，它们封装了数据和相关的行为（如 `task.lock()`）。工作流中的数据传递从裸的 JSON 对象升级为操作这些类的实例。
  - **里程碑**: 在 V8 版本中，我们实现了**端到端的智能闭环**。`planningStep` 和 `executionStep` 真正开始调用 `plannerAgent` 和 `runnerAgent` 来完成它们的任务，而不再是硬编码的逻辑。

#### **4. 当前状态 (V9 及以后) 与下一步计划**

我们当前的版本已经是一个功能相当完备的核心原型。`index.ts` 文件包含了智能化的工作流，`entities.ts` 定义了我们的数据模型，`services/logManager.ts` 则封装了我们创新的 AI 驱动的文件处理服务。

**我们已确认的下一步计划是，让 JIXO V3 具备处理并发协作的能力。**

**具体行动计划**:

1.  **完善 `runJixoOuterLoop` 以模拟并发**:

    - **目标**: 让外层循环能够一次性、异步地启动多个 `jixoJobWorkflow` 实例。
    - **实现**: 使用 `Promise.all` 来并发执行多个 `run.start()` 调用。
    - **关键**: 在启动每个 `run` 时，必须正确地构建并传入 `otherRunners` 列表，以便每个工作流实例都能知道“邻居”的存在。

2.  **在 `triageStep` 中实现完整的并发处理逻辑**:
    - **目标**: 基于传入的 `otherRunners` 列表，实现 `PROTOCOL 0` 中关于并发处理的核心规则。
    - **实现**:
      - **僵尸锁（Stale Lock）处理**: 遍历 `roadmap` 中所有 `status: "Locked"` 的任务。如果任务的 `runner` ID **不**存在于 `otherRunners` 列表中，则说明该锁是“僵尸锁”，必须将其状态重置为 `"Pending"`。
      - **待命退出（Standby Exit）**: 在完成了僵尸锁处理和失败任务检查后，如果发现**没有** `"Pending"` 任务，但**存在**被其他活跃 `runner` 锁定的任务，则当前 `run` 应该立即返回 `{ role: "Exit", payload: { exitCode: 2 } }`，以避免空转和资源浪费。

完成这些步骤后，我们的 JIXO V3 将不仅是一个智能的单体代理，更是一个具备了初步分布式协作能力的**多智能体系统**的基础。这将是整个项目的一个决定性飞跃。

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

[.jixo/meta.tmp.md](@INJECT)
