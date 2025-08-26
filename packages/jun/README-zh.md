# @jixo/jun

一个强大的、有状态的 Deno Shell 代理和任务运行器。`jun` 通过记录所有执行过的命令及其 stdio、管理长期运行的后台进程以及提供可查询的历史记录，来增强你的命令行工作流。

## 核心特性

- **有状态执行:** 每一个通过 `jun` 运行的命令都会被追踪，其输出也会被记录。
- **后台进程管理:** 轻松运行长期任务（如 `tsc --watch`），并用简单的命令来管理它们。
- **持久化历史:** 所有任务，无论是已完成还是正在运行，都会被保存在历史记录中以供查阅。
- **完整的 I/O 日志:** 捕获每个任务的 `stdout` 和 `stderr`，非常适合调试和审计。
- **文件系统后端:** 使用简单透明的 `.jsonl` 格式存储在本地的 `.jun` 目录中，易于检查或备份。
- **双重接口:** 既可以作为全局 CLI 工具使用，也可以作为 Deno 模块在你的项目中以编程方式调用。

## 安装

要将 `jun` 作为全局命令行工具使用，请直接从 JSR 安装：

```sh
deno install -A jsr:@jixo/jun/cli --name jun
```

这会将 `jun` 可执行文件安装到你的 Deno 安装目录的 `bin` 路径下。

## CLI 用法

### `jun init`

在当前工作目录中初始化一个 `.jun` 目录。该目录将用于存储项目的所有任务元数据和日志。如果找不到本地的 `.jun` 目录，`jun` 将会使用全局的 `~/.jun` 目录。

```sh
jun init
# 输出: Jun directory initialized at: /path/to/your/project/.jun
```

### `jun run <command> [args...]`

执行一个 Shell 命令，代理其 stdio，并记录所有内容。

```sh
# 运行一个简单的命令
jun run echo "你好, Jun!"

# 运行一个长期进程 (例如，文件监视器)
# 该进程将持续运行，而 `jun` 会在它启动后立即退出。
# 之后你可以使用 `jun ls` 来查看它正在运行。
jun run tsc --watch
```

### `jun ls [--json]`

列出所有当前**正在运行**的任务。

```sh
jun ls
# PID   STATUS      START_TIME          COMMAND
# ---   ------      ----------          -------
# 2     running     2025-08-27 10:30:00   tsc --watch

# 以 JSON 格式获取输出
jun ls --json
```

### `jun history [--json]`

列出**所有**任务（包括运行中、已完成、已终止等）的历史记录，按最近的排序。

```sh
jun history
# PID   STATUS      START_TIME          COMMAND
# ---   ------      ----------          -------
# 2     running     2025-08-27 10:30:00   tsc --watch
# 1     completed   2025-08-27 10:29:00   echo "你好, Jun!"
```

### `jun cat <pid...>`

显示一个或多个任务的详细元数据和完整的 `stdio` 日志。

```sh
jun cat 1
# --- Log for PID 1: echo 你好, Jun! ---
# [10:29:00.123][stdout] 你好, Jun!
```

### `jun rm <pid...> | --all | --auto`

从历史记录中移除任务及其关联的日志。

- `jun rm 1 3`: 移除 PID 为 1 和 3 的任务。
- `jun rm --all`: 移除所有**已结束**（非运行中）的任务。
- `jun rm --auto`: 移除所有已结束的任务，但保留最近的 10 条。

```sh
jun rm 1
# 输出: Removed 1 task(s).
```

### `jun kill <pid...> | --all`

停止一个或多个正在运行的后台任务。

- `jun kill 2`: 停止 PID 为 2 的任务。
- `jun kill --all`: 停止**所有**当前正在运行的任务。

```sh
jun kill 2
# 输出: Killed 1 task(s).
```

## 作为模块使用 (API)

你也可以在你的 Deno 项目中直接使用 `jun` 的核心逻辑。

```typescript
import {junRunLogic, junHistoryLogic, junCatLogic} from "jsr:@jixo/jun";

// 注意: 请先确保 .jun 目录已被初始化。
// 在你的应用设置阶段:
// import { junInitLogic } from "jsr:@jixo/jun";
// await junInitLogic();

// 运行一个命令并等待它完成
const exitCode = await junRunLogic("ls", ["-la"]);
console.log(`命令以退出码 ${exitCode} 完成`);

// 获取历史记录
const allTasks = await junHistoryLogic();
console.log("所有任务:", allTasks);

// 获取最近一个任务的日志
if (allTasks.length > 0) {
  const lastTaskPid = allTasks.pid;
  const {success} = await junCatLogic([lastTaskPid]);
  console.log(`任务 ${lastTaskPid} 的日志:`, success[lastTaskPid]);
}
```

## 开源许可

MIT

// JIXO_CODER_EOF
