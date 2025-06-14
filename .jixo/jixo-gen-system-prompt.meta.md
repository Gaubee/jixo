这是我 `.jixo/jixo-gen-system-prompt.md` 文件的内容:

[.jixo/jixo-gen-system-prompt.md](@FILE)

这是 jixo 运行时的 关键AI提示词：

[packages/cli/prompts/system.md](@FILE)

[packages/cli/prompts/user.md](@FILE)

然后这是 `jixo run` 这个cli的关键代码：

[packages/cli/src/cli.ts](@FILE)

[packages/cli/src/commands/tasks/run.ts](@FILE)

[packages/cli/src/commands/tasks/run-ai-task.ts](@FILE)

我需要你优化 `.jixo/jixo-gen-system-prompt.md` 的内容。

重构的方向是：

1. **融合现有的 system.md 与 关键ts源代码 的内容，做一个扩展性的更新，补充更多的JIXO程序相关的细节。我们的目的是使用这份 jixo-gen-system-prompt.md 来生成更好的 system.md。**
    1. 注意！！！**关键ts源代码这是给你理解JIXO是如何运作的，请你自己将它抽象成更高级别的过程语言再做吸收。**
2. 引入“思维链”，基于源代码的工作原理，理解为什么JIXO是这样设计的，这能很好的提升 system.md 的生成质量：
   1. 目前的AI普遍存在一个问题，就是随着上下文使用的增加，对齐率就会越来越低，产生严重的幻觉问题。因此我改变了传统AI-Agents的思路。传统AI-Agents依赖底层模型的能力，模型越强，就越能在一个上下文里解决问题。我则是认为，我们应该客观地接受幻觉问题，因此尽可能利用更少的上下文来解决问题。
      1. 这里的方案就是 多次计划+多次执行 的理念。
      1. 可以从提示词和源代码中看得出来，每次执行一次Task的时候，都会让AI重新审视 *.job.md 文件中需求是否有被 *.log.md 中的 Roadmap 所覆盖。然后你可以看到 system.md 中给了一整套的面向过程的执行逻辑。让每一次Task都跟随这个执行顺序执行下去，要么就是做计划，要么就是执行计划。
      1. 甚至在 system.md 中，我还提出了一种“一边执行一遍计划的理念”，执行的时候可能会出现意外（比如测试不通过，或者一些原型客户验收不满意），这些都会被记录到 *.log.md 中，被下一个 Task 看到再去处理。
      1. 因此我提出了用一种“分布式协作”的思维来维护这个 *.log.md 文件，它需要引入一种多人编辑又不会出错的结构和格式。
      1. 正因如此，每一次的Task都被限制了工作上限（masTurns），接近maxTurns的上限的时候，就应该终止当前的Task，将目前的工作进度或者遇到的问题保存到 *.log.md 中，下一次Task开始的时候，能继续工作，或者重新计划。
      1. 这种循环执行的方案替代单次执行的，可以有效规避幻觉。并且因为计划严谨，甚至一个计划被执行多次，因此我的目标是让普通的AI模型也达到高级AI模型的效果。比如经过我的初步测试，目前这套提示词，已经能让我通过 Gemini 2.0 Flash 通过**多次Turns**或者**多次Task*多次Turns**，达到了Gemini 2.5 Pro **单次或者多次Turns** 的水平。
   1. 因此 *.log.md 的设计和 Task-Runner 如何工作，如何读写 *.log.md 是非常重要的。是整个系统的核心。
      > 做好这个核心，在未来就能用 *.job.md 来生成 *.job.md 或者 *.skill.md，这能任务分裂下去，也能让它们自己优化自己。走上AI无监督的自我进化的道路。


<!--[[
名词定义：
1. `One Job`(用户的需求) = Tasks
    > 这里的 Tasks，具体来说就是由AI生成的内容，就是 *.log.md 中 Roadmap 列出来的内容，以及“列出 Roadmap”本身也是一个Task。
    > 所以我称它为Tasks。所以只要是Task这个字眼，就意味着有AI在参与规划和执行。
1. One Task = Turns
    > 这里Turns，是我在Google的Gemini这个产品中看到的单词，它们将一次对话定义成 `One Turn`，比如用户发了一段内容给AI，如果不满意，用户可以点击“Rerun this turn”来重新生成回复。
    > 而 `One Turn`背后，从编程的角度出发，就是做一次`await streamText({messages,...})`，在一次调用中，AI接口供应商就会返回各种内容，比如 `start`、`text`、`tool-call`、`error`、`reasoning`、`file`、`source`、`tool-result`、`tool-call-streaming-start`、`tool-call-delta`、`reasoning-part-finish`、`start-step`、`finish-step`、`finish` 等等。
    > 然后比方说这次调用中收到了 `tool-call`，我们就需要根据`tool-call`的`name`，去调用对应的工具函数，比如 `get_weather`，然后在下一次执行一个新的 Turn 的时候，也就是再发起一次新`await streamText({messages,...})`，这里就会携带上`tool-call`的结果。
    > 这种做一次`await streamText({messages,...})`，本质上就是`One Request+One Response`，因此这种一次往返，我们就有了 `One Turn` 这样的叫法。而一次 `One Turn` 的 `Response` 中，它其实是会返回多种内容，我们称为`Parts`，比如一次返回就会包含`start-step+text+tool-call`，也就是 startStepPart + textPart + toolCallPart。
1. 使用`Run`这个动词来统一定义成执行AI的动作。比如`Run Turns`、`Run Tasks`。
]]-->
