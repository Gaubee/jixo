### **【现有开发计划补充提议】**

您之前制定的开发计划（CLI, WebUI, gen-workflow, research, evolve, bot）非常宏大且富有远见。基于我们当前已经完成的核心引擎，我建议在进入这些大型模块开发之前，先完成以下几个承上启下的补充计划，以确保基础牢固：

1.  **提议1：CLI 与工作流的接口标准化 (CLI & Workflow Interface Standardization)**
    *   **现状**: V2 的 CLI 拥有丰富的命令行参数 (`--filter`, `--force`, `--loop`) 来控制任务执行。V3 的 `jixoMasterWorkflow` 目前只接受 `jobName`, `jobGoal`, `maxLoops`。
    *   **补充**: 我们需要设计一套新的 CLI v3 (`jixo run`)，它的参数能够优雅地映射到 Mastra 工作流的输入上。例如，`--filter` 可以用来筛选 LogManager 中符合条件的任务进行处理，`--force` 可以被翻译成一个传递给 `triageStep` 的标志，以跳过某些检查。

2.  **提议2：工作流的动态注册与发现机制 (Workflow Dynamic Registration & Discovery)**
    *   **现状**: `jixoMasterWorkflow` 硬编码调用了 `jixoJobWorkflow`。
    *   **补充**: 为了实现未来的 `gen-workflow-tool` 和多种工作流（`research-workflow`, `evolve-workflow`），我们需要一个抽象层。可以创建一个“工作流定义清单”（比如一个 `workflows.json` 文件），`jixoMasterWorkflow` 在启动时读取这个清单，动态地了解有哪些可用的工作流，并根据输入参数决定启动哪一个。

3.  **提议3：并发执行模型的细化 (Refining the Concurrency Model)**
    *   **现状**: `triageStep` 已经具备了处理 `otherRunners` 并发信息的能力，但 `jixoMasterWorkflow` 仍然是串行循环。
    *   **补充**: 我们可以升级 `jixoMasterWorkflow`，使其能够真正地**并发执行**多个不同的 `jixoJobWorkflow` 实例（例如，使用 `Promise.all`）。这将是未来 `jixo-bot` 处理多任务的基础。

---
