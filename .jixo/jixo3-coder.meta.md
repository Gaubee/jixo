我review合并了你部分的代码，并且手动更新了测试代码，以下是目前最新的代码。

[`next/src/**/*.ts`](@FILE)


接下在我们的计划中，下一步是应该是**第二部分：完善细节 (Next Steps)**这一环节了吧？

```md
1.  **真正的并发执行**: 修改 `jixoMasterWorkflow`，使用 `Promise.all` 同时启动多个 `jixoJobWorkflow` 实例，并正确构建和传递 `otherRunners` 列表，以测试 `Triage` 步骤中僵尸锁和待命退出的逻辑。
2.  **完整的 `Planner` 逻辑**: 增强 `planningStep`，使其能够处理**修复失败任务**和**修改现有计划**的场景，而不仅仅是创建初始计划。它需要接收 `triageStep` 传来的上下文（如 `fixTaskId`）。
3.  **健壮的错误处理**: 在每个 `Step` 中加入 `try...catch` 块，并为 `Task` 增加 `Failed` 状态的转换逻辑。当 `executionStep` 失败时，它应该能将任务标记为 `Failed` 并记录失败日志，以便 `Triage` 在下一轮发现并转交给 `Planner`。
4.  **配置管理**: 将 `jobName`, `jobGoal`, `llm models` 等硬编码的常量提取到一个单独的配置文件 (`config.ts`) 或通过环境变量加载，提高灵活性。
```

我看了原本的计划，我觉得应该优先让 Planner 和 Runner 这两部分更加完善。

1. 首先为了避免混淆，我觉得应该将 Runner 改成 Executor （执行者，这样和 Planner 会更加呼应）
1. 然后关于 Planner 逻辑的完善：
   1. 增强 `planningStep`，使其能够处理**修复失败任务**和**修改现有计划**的场景，而不仅仅是创建初始计划
   1. 改进 计划的输出格式，使得更加专业
      1. 新增 `dependsOn:string[]` 字段以表示依赖关系。这样在做并发做计划的时候，可以基于依赖关系挑选出一个可以独立执行的任务了来。
      1. 新增 `title:string` 和 `details?:string`，并且原本的 `description:string` 应该变成可选 `description?:string`:
         1. 其中 title 作为 description 的一个简化标题，更适合用来当作“引用”；
         1. 而 details 则是计划者直接在计划阶段提供了一份详细的执行计划，可以避免 Executor 在执行任务的时候出现偏差。它可以具体到比对对哪些文件哪些类做哪些新增修改删除等等具体的实施步骤。它没有抽象的理念，而是工程执行过程中的一个具体工作清单，可以用来做验收工作（未来我们可以新增一个AI验收人员的角色来对 Executor 的产出做打分）。
         1. 最后 description 之所以要改成可选的，是因为我们有了 title 这个必选字段了，而且有的时候一个任务主要是由它的子任务组成，子任务就会包含了详细的描述和工作内容，因此 description 和 details 就可选了。
      1. 新增 `tags?:string[]` 可以对任务做一个分类，未来可以基于这个分类进一步分化出不同职责的 Executor。可以进一步提升 AI-Executor 的工作准确率。比如有的可以专门修复bug，有的可以专门优化算法，有的可以专门撰写架构，有的可以专门开发前端、有的可以专门开发后端、有的可以专门撰写报告等等。
      1. 当它是可选的，也是因为子任务的存在。只要子任务包含了更加详细的工作内容、描述、分类，那么父任务理论上就之需要提供一个title就够了。当然，这主要取决于计划者自己如何利用这些字段，我们这边只是提供一些足够灵活的设计和可靠的工具。
      1. tags 还有一个作用，它和 details 类似的作用，就是对任务做详细的补充。但是 tags 还有一些灵活的用法，会比 details 更加适合，比如说它可以用来做“索引”。我详细一点，来举例这种索引的用法：
         1. `tags:["branch:xxx"]` 可以用来标记说这些改动将发生在某个git分支上。当然我们现在的工作流里面没有关于git分支的能力，而且这里主要是一个“建议”和“索引”，`tags` 本身并没有足够的约束力，只是在提供一个“建议”。但如果未来需要，我们可能会提出一个“强约束”的字段，比如 `gitBranch?: boolean|string`
1. 关于 Executor 的逻辑完善：
   1. Executor在接受任务执行的时候，应该给它这个任务的完整节点与要执行任务的ID
      1. 也就是说我们需要将它要执行的父任务的节点，直到根节点，枝剪后给Executor，并告诉Executor它具体要执行任务的ID。
         > 举个例子说这样的Tree： `A-> B/C -> B1/B2 / C1/C2` ,然后我们要让Executor执行B1，就得提供 `A - B - B1`+ `完成B1` 这样的信息给 Executor。
      1. 因为父任务往往有一些上下文信息，完整提供给Executor是有意义的。
   1. 新增一个 `gitCommit:boolean|string` 字段，意味着每次执行完 Executor 之后，应该调用 git-tools 来对代码做一次提交
      1. 这里 `string` 类型意味着提供一个 git-commit 的模板或者风格，让AI参照这个风格来生成 commit-message。
      1. 注意，只是 commit，不会做 git-push，这部分如果有需要，未来可以另外加字段来做自动化，否则目前只能是外部来做push（比如人类自己来做push）
      1. 后续我会提供 git-mcp-tools，所以你暂时不用自己实现 git-commit 的具体功能。但如果你觉得我们应该独立成一个workflow-step，那我尊重你的意见。
1. 新增一个 Reviewer 的角色，来使得工作流程更加的完善
   1. RoadmapTaskNode 新增一个 `reviewer?:string` 的字段
   1. Reviewer 将发生在每一个 RoadmapTaskNode 被标记为 Completed 之后进行触发，对内容进行审核。如果内容通过审核，则进行下一步，否则进行回退。否则应该将“修改意见”传递给 Planner，让它补充工作内容。
   1. 举一个具体的例子：`A-> B -> B1/B2`：
      1. B1 完成后，触发Reviewer
      1. B2 完成后，触发Reviewer
      1. B1/B2 都 Reviewed 后理论上会自动触发 B 的完成，紧接着也会触发 Reviewer，对B任务的完成情况做评估
      1. B Reviewed 后，自动触发A完成，然后对 A 任务的完成情况做评估
      1. 这里的每一次评估，如果评估不通过，status会重新进入Pending，然后“修改意见”会发送给 Planner，让他补充工作计划的内容。
      1. 后续自然就会重新触发醒的循环，让 Executor 来执行补充的工作计划。