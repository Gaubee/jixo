我review合并了你部分的代码，并且手动更新了测试代码，以下是目前最新的代码。

[`next/src/**/*.ts`](@FILE)

1. 你一直在改动我的`children: RoadmapTaskNodeData[]`,你非得改成 `children?: RoadmapTaskNodeData[]` ，不要再修改这部分了，请你尊重我对你代码做出的更改，我已经强调过了，以我为主。
2. 然后我看你是一次性讲我提出的三个任务都给做了，请你确定已经都完成了吗？请你确认。
3. 你在triageStep这里，去挑选任务，我觉得有点不对劲，这里的核心逻辑应该统筹到 logMananger 去管理，由logManager提供任务挑选的逻辑实现。
4. 请同步相关的更新测试代码。
