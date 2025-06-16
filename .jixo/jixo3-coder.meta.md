感谢，我已经review并合并了你的代码。

以下是最新代码：

[`next/src/**/*.ts`](@FILE)


### **下一步计划，我们需要先聚焦于“非并发”，完善基础的循环逻辑**

**`jixoMasterWorkflow`的循环能够更加合理**

*   **目标**: `jixoMasterWorkflow` 不在基于maxLoops这个单调的配置来做限制，而是基于客观的任务进度。
*   **行动**:
    1. 改进循环机制，基于 logManager 的进度信息，来持续进行
       1. maxLoops 仍然可以限制，但它现在默认是 “无限大”
       1. 对于进度的计算，需要更加的合理，因为我们现在有三个角色：Planner、Executor、Reviewer，我们需要基于角色和 Roadmap 的信息来做精确的计算。
    1. 提供tools:jixo_tasks_exit 给agent
       1. Reviewer 作为一个观察者，它应该要能反省目前整体的工作状况，在发现陷入重复犯错的情况下下，调用工具结束循环
           > 重复犯错是指 Reviewer 向 Planner 报告错误，Planner生成新的任务1， Executor 执行新任务1，Reviewer 再次向 Planner 报告错误，Planner生成新的任务2，如果此时“新的任务2”和“新的任务1”没有本质差别，说明已经开始进入重复犯错的阶段了，此时如果再做一轮，来到“新的任务3”，仍然和“新的任务2”和“新的任务1”没有本质差别，并且 Executor 执行新任务3，报错的信息仍然和 执行“新的任务2”和“新的任务1”的结果类似，说明陷入了循环。此时就要调用 jixo_tasks_exit 来结束。
    1. 还有一种退出循环的可能，就是堆栈报错，也就是我们没有处理的异常，如果重试连续3次都是异常，那么结束循环。如果重试有成功，那么异常次数重制成0.
       1. 主要是的错误是：“服务商那边的AI的费用消耗完了”、“用户设定的开销额度消费完了”、“服务商服务器异常”等


**在 `triageStep` 中实现完整的并发协议**

*   **目标**: 基于传入的 `otherRunners` 列表，实现 `PROTOCOL 0` 中关于并发处理的核心规则，使 JIXO 具备分布式环境下的健壮性。
*   **行动**:
    1.  **僵尸锁（Stale Lock）处理**:
        *   在 `triageStep` 的开头，我将添加逻辑来遍历 `roadmap` 中所有 `status: "Locked"` 的任务。
        *   如果一个任务的 `executor` ID **不**存在于传入的 `otherRunners` 列表中，并且也**不等于**当前 `runner` 的 ID，那么这个锁就被认为是“僵尸锁”。
        *   `triageStep` 将调用 `logManager.updateTask` 将这些僵尸锁任务的状态重置回 `"Pending"`。
    2.  **待命退出（Standby Exit）**:
        *   在完成了僵尸锁处理和失败/返工任务检查之后，如果 `logManager.getNextActionableTask` 返回 `type: "none"`（意味着没有可执行的任务），我们需要进行更精细的判断。
        *   `triageStep` 将检查是否存在任何被其他活跃 `runner`（即存在于 `otherRunners` 列表中的 `executor`）锁定的任务。
        *   如果存在这样的任务，那么当前 `runner` 就没有必要空转。它应该立即返回 `{ action: "exit", exitInfo: { exitCode: 2, reason: "No available tasks. Other runners are active." } }`。这完全符合 `system.md` 的 `code: 2` (Standby) 退出协议。
