# @jixo/jun

`@jixo/jun` 是一个有状态的 Shell 代理工具，旨在管理和持久化 Shell 命令的执行过程。它允许您无缝地运行命令、跟踪历史记录、查看输出并管理后台进程。

## 特性

- **有状态执行**: 为每个运行的命令持久化元数据和 stdio。
- **后台任务**: 轻松启动和管理长时间运行的后台进程。
- **历史跟踪**: 查看所有已执行命令的历史记录。
- **日志审查**: 检索并审查任何任务的完整 stdio 日志。
- **进程管理**: 列出并终止正在运行的后台任务。
- **本地与全局上下文**: 在本地 `.jun` 目录中操作，或回退到全局的 `~/.jun` 目录。

## 安装

```bash
# 使用 pnpm
pnpm add @jixo/jun

# 或全局安装
pnpm add -g @jixo/jun
```

## 命令

### `jun init`

在当前工作目录中初始化一个本地的 `.jun` 目录。这将使所有后续的 `jun` 命令都作用于此目录。

```bash
jun init
```

### `jun run <command> [args...]`

在**前台**执行一个命令。`jun` 会等待命令执行完成，然后记录其最终状态。

- **用法**: `jun run tsc --build`
- **详情**:
  - 命令的输出 (stdout/stderr) 会实时流式传输到您的终端。
  - 整个会话都会被记录下来，之后可以通过 `jun history` 和 `jun cat` 进行回顾。
  - 返回进程的退出码。

### `jun start <command> [args...]`

在**后台**启动一个命令。`jun` 会立即返回，并为您提供一个进程 ID (`pid`)，而命令会继续在后台运行。

- **用法**: `jun start vite dev`
- **详情**:
  - 非常适合长时间运行的进程，如开发服务器或文件监听器。
  - 任务会被 `jun` 注册，并可以通过 `jun ls` 和 `jun kill` 进行管理。
  - 返回一个用于管理的 `pid`。

### `jun ls`

列出所有当前正在运行的、由 `jun start` 启动的后台任务。

### `jun history`

显示由 `jun` 执行的所有任务的历史记录，包括正在运行、已完成、已终止和出错的任务。

- **`--json`**: 以 JSON 格式输出历史记录。

### `jun cat <pid...>`

显示一个或多个指定任务的详细元数据和完整的 stdio 日志。

- **`<pid...>`**: 一个或多个要审查的任务 PID。
- **`--json`**: 以 JSON 格式输出日志。

### `jun rm [pid...]`

从历史记录中移除任务记录。

- **`[pid...]`**: (可选) 要移除的特定 PID。
- **`--all`**: 移除所有已结束的任务（已完成、已终止、错误）。
- **`--auto`**: 自动清理旧任务，仅保留最近的 10 条和所有正在运行的任务。

### `jun kill <pid...>`

停止一个或多个正在运行的后台任务。

- **`<pid...>`**: 一个或多个要终止的任务 PID。
- **`--all`**: 终止所有当前正在运行的任务。

## 编程 API

`@jixo/jun` 还将其核心逻辑作为编程 API 导出，以便在其他工具中使用。

```typescript
import {junRunLogic, junStartLogic, junHistoryLogic, junLsLogic, junCatLogic, junKillLogic, junRmLogic} from "@jixo/jun";

// 示例：启动一个后台服务器
await junStartLogic({
  command: "npm",
  commandArgs: ["run", "dev"],
  json: false,
});

// 示例：获取历史记录
const history = await junHistoryLogic();
console.log(history);
```

## 工作原理

`jun` 在一个 `.jun` 目录中维护其状态。

- **`meta.jsonl`**: 一个 JSON Lines 文件，作为所有任务元数据的数据库。每一行都是一个代表 `JunTask` 的 JSON 对象。
- **`logs/*.jsonl`**: 每个任务的 stdio 输出都会被流式传输到以其 `pid` 命名的相应日志文件中。

这种基于文件的方法使得状态透明、可移植，并且易于手动检查或调试。
