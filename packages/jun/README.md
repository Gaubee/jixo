# @jixo/jun

`@jixo/jun` is a stateful shell proxy tool designed to manage and persist shell command executions. It allows you to run commands, track their history, view their output, and manage background processes seamlessly.

## Features

- **Stateful Execution**: Persists metadata and stdio for every command run.
- **Background Tasks**: Easily start and manage long-running background processes.
- **History Tracking**: View the history of all executed commands.
- **Log Inspection**: Retrieve and inspect the full stdio log for any task.
- **Process Management**: List and terminate running background tasks.
- **Local & Global Context**: Operates on a local `.jun` directory or falls back to a global `~/.jun` directory.

## Installation

```bash
# Using pnpm
pnpm add @jixo/jun

# Or globally
pnpm add -g @jixo/jun
```

## Commands

### `jun init`

Initializes a local `.jun` directory in the current working directory. This scopes all subsequent `jun` commands to this directory.

```bash
jun init
```

### `jun run <command> [args...]`

Executes a command in the **foreground**. `jun` will wait for the command to complete and then record its final status.

- **Usage**: `jun run tsc --build`
- **Details**:
  - The command's output (stdout/stderr) is streamed to your terminal.
  - The entire session is logged and can be reviewed later with `jun history` and `jun cat`.
  - The process exit code is returned.

### `jun start <command> [args...]`

Starts a command in the **background**. `jun` will immediately return, providing you with a process ID (`pid`), while the command continues to run.

- **Usage**: `jun start vite dev`
- **Details**:
  - Ideal for long-running processes like development servers or watchers.
  - The task is registered with `jun` and can be managed with `jun ls` and `jun kill`.
  - Returns a `pid` for the managed task.

### `jun ls`

Lists all currently running background tasks that were started with `jun start`.

### `jun history`

Displays a history of all tasks executed by `jun`, including running, completed, killed, and errored tasks.

- **`--json`**: Output the history in JSON format.

### `jun cat <pid...>`

Displays the detailed metadata and full stdio log for one or more specified tasks.

- **`<pid...>`**: One or more task PIDs to inspect.
- **`--json`**: Output the logs in JSON format.

### `jun rm [pid...]`

Removes task records from the history.

- **`[pid...]`**: (Optional) Specific PIDs to remove.
- **`--all`**: Remove all finished tasks (completed, killed, error).
- **`--auto`**: Automatically clean up old tasks, keeping the 10 most recent and all running tasks.

### `jun kill <pid...>`

Stops one or more running background tasks.

- **`<pid...>`**: One or more PIDs of tasks to kill.
- **`--all`**: Kill all currently running tasks.

## Programmatic API

`@jixo/jun` also exposes its core logic as a programmatic API for use in other tools.

```typescript
import {junRunLogic, junStartLogic, junHistoryLogic, junLsLogic, junCatLogic, junKillLogic, junRmLogic} from "@jixo/jun";

// Example: Start a background server
await junStartLogic({
  command: "npm",
  commandArgs: ["run", "dev"],
  json: false,
});

// Example: Get history
const history = await junHistoryLogic();
console.log(history);
```

## How It Works

`jun` maintains its state within a `.jun` directory.

- **`meta.jsonl`**: A JSON Lines file that acts as the database for all task metadata. Each line is a JSON object representing a `JunTask`.
- **`logs/*.jsonl`**: Each task's stdio output is streamed to a corresponding log file named after its `pid`.

This file-based approach makes the state transparent, portable, and easy to inspect or debug manually.
