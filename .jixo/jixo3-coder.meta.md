感谢，我已经review并合并了你的代码，并做出了一些改动，请务必以我最新的代码为基础来进行开发。

以下是最新代码：

[`next/src/**/*.ts`](@FILE)

但是我在测试的时候发现了一些问题。

我执行了 demo 文件夹中运行了 index.demo.ts 这段代码，在任务执行的过程中，发生了一些错误，然后引发了中断，日志文件内容如下：

```md
---
title: _undefined_
progress: 0%
---

## Roadmap

- [ ] 1 Set up project directory
  - status: PendingReview
  - executor: runner-5
  - description: Create the basic project structure.
  - tags: [setup]
- [ ] 2 Create and write 'hello world' script
  - status: Pending
  - description: Write the core Node.js code.
  - tags: [code, nodejs]
- [ ] 3 Run the 'hello world' script
  - status: Pending
  - description: Execute the Node.js file.
  - tags: [run, nodejs]

## Work Log

### Log-6 @ 2025-06-16T15:38:14.435Z for runner-6

- **Role**: Reviewer
- **Objective**: Review task 1
- **Result**: Failed
- **Summary**: Reviewer aborted job: ABORT: The Executor is repeatedly failing because the required path for the project directory has not been provided in the task details, despite rework attempts.

### Log-5 @ 2025-06-16T15:38:09.797Z for runner-5

- **Role**: Executor
- **Objective**: Execute task 1
- **Result**: Succeeded
- **Summary**: I did not receive any details about setting up the project directory. Please provide more information.

### Log-4 @ 2025-06-16T15:38:07.465Z for runner-4

- **Role**: Planner
- **Objective**: Rework task 1 based on feedback
- **Result**: Succeeded
- **Summary**: Updated 1 task(s).

### Log-3 @ 2025-06-16T15:38:04.093Z for runner-3

- **Role**: Reviewer
- **Objective**: Review task 1
- **Result**: Failed
- **Summary**: Requires rework. Feedback: - Specify the path where the project directory should be created.

### Log-2 @ 2025-06-16T15:38:00.666Z for runner-2

- **Role**: Executor
- **Objective**: Execute task 1
- **Result**: Succeeded
- **Summary**: I cannot navigate the terminal. I can create a directory at a given path. What is the path where I should create the directory?

### Log-1 @ 2025-06-16T15:37:58.147Z for runner-1

- **Role**: Planner
- **Objective**: Create initial project plan
- **Result**: Succeeded
- **Summary**: Added 3 new root task(s).
```

这里它遇到了一些问题，然后就把自己中断了。
这是我的终端输出：

```
PS E:\dev\github\jixo2\next> pnpm demo

> jixo@1.0.0 demo E:\dev\github\jixo2\next
> cd demo && node ../dist/mastra/index.demo.js

Secure MCP Filesystem Server running on stdio.
Allowed directories: [ 'E:\\dev\\github\\jixo2\\next\\demo' ]
MCP pnpm server running on stdio. Ready for commands.
JIXO V3 Core Services Initialized. Starting Master Workflow...

--- JIXO Master Loop #1 (Consecutive Errors: 0) ---
[Master Loop] Inner cycle finished with code 1: Reviewer aborted job: ABORT: Repetitive failure cycle detected. The required project directory path is still not being successfully communicated or used in the task execution.

✅ [JIXO] Master workflow finished. Final status: Job failed: Reviewer aborted job: ABORT: Repetitive failure cycle detected. The required project directory path is still not being successfully communicated or used in the task execution.
```

这里有两个问题：
**第一个问题**：它得不到当前目录，这点其实在 JIXO-v2 的时候不是问题，因为在 v2 版本，我提供了大量的上下文信息给到AI，等一下我会提供给你V2的源代码，你可以参考一下。

> 但其实我提供了pnpm工具，AI其实是可以通过`pnpm dlx node -e "console.log(process.cwd())"`来获得当前环境目录。只不过这种方法很考验AI自身的使用能力的悟性，所以并不强求AI能理解这里的用法，毕竟我也没告诉AI当前环境一定存在node可执行程序。

**第二个问题**：为什么它遇到问题后，似乎并没有让 Planner 重新根据错误信息重新进行规划，然后继续任务循环。

---

然后，这里我给出V2的源代码：

[`packages/cli/src/**/*.ts`](@FILE)
