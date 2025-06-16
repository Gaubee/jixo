这是目前JIXO-v3的最新代码（主要通过AI生成，我负责review和修复一些基本的编译错误与代码规范）：

[`next/src/**/*.ts`](@FILE)

这是JIXO-v2的“系统提示词”`system.md`

[packages/cli/prompts/system.md](@FILE)

这是JIXO-v2的“用户提示词”模板 `user.md`

[packages/cli/prompts/user.md](@FILE)

我们的目标，是在 JIXO-v2 这些提示词的愿景山，实现 JIXO-v3。
JIXO-v3 需要先实现 JIXO-v2 的目标，并且有着极好的稳定性，和评估、进化的能力。

---

目前仍然出于快速迭代阶段。我们需要基于 mastra 的最佳实践，继续完成我们的JIXO应用。

我目前先列出了这样几个目标：

1. 首先是一些“改进内容”：
   1. runJixoOuterLoop 这个函数属于非 mastra 的标准，我们应该在 mastra 的接口体系中，直接完成整个 JIXO 的外循环。
      1. 而且是工作流有明显的问题，没有符合 system.md 中的要求。理想情况下应该是 `plan -> work -> work -> ..works.. -> complete`，在这个理想情况下，去完善分支，这样才对
   2. logManager的update没有符合我之前的要求，我的要求是：因为`logData:LogFileData`是类型安全的，所以可以直接用代码将这个结构转化成markdown格式，然后基于这个markdown内容生成hash，使用`[cache-dir]/[hash].json`存储logData。这样做的目的是在对markdown做parser的时候，算出来的hash如果可以到cache-dir中找到对应的json文件，那么就可以省去AI做parser这一步骤。
      > 这里还有一些子任务:
      1. 请确保 RoadmapTaskSchema 和 WorkLogEntrySchema 已经完全符合我在 system.md 中提到的标准规范。
         1. 比方说缺少 RoadmapTask “废弃”字段，因为根据哲学，log不能删除，所以只能通过标记的方式将它标记成废弃
         1. 比方说 RoadmapTask 缺少children字段，因为 RoadmapTask 是一个树结构，所以它应该有children字段，用于存储子任务。
      1. mastra 现在是直接把 parserAgent 和 serializerAgent 放到了agents里头了，我觉得应该是通过logManager提供tools来读写能力，由logManager自身完成对log文件的完整操作。这些操作应该足够细致，比如：
         1. `getRoadmap` 获取一整个 `Roadmap` 对象
         1. `updateRoadmapItem(path:string, item: Partial<RoadmapItem>)` 基于 Roadmap-Tree 的路径，更改单个 RoadmapTask 的部分字段。注意，我这里是通过RoadmapItem的方式来减少输入，当“减少输入”和“删除字段”可能会因此冲突，所以统一的，如果字段内容是一个特殊的标记内容，比如`"<!--DELETE-->"`那么就意味着移除字段
         1. `addRoadmapItem(parentPath:string, item:RoadmapItem)` 基于 Roadmap-Tree 的路径，添加一个 RoadmapTask 任务，如果要添加到根节点，那么 parentPath 就为 `""`
         1. 诸如此类... 还有很多接口设计应该考虑，这点由你来补充完善，我来审视。
1. 然后是继续“完善细节”
   > 这部分等完成以上的“改进内容”后我再补充，或者你可以列出一些
1. 最后是开发一些新功能
   > 这部分等完成以上的“完善细节”后我再补充，或者你可以列出一些

基于以上的目标，请你对现有的系统提示词做出补充，好让我们更好地协同完成工作。
