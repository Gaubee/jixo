# @jixo/jun

A powerful, stateful shell proxy and task runner for Deno. `jun` enhances your command-line workflow by logging all executed commands and their stdio, managing long-running background processes, and providing a queryable history.

## Core Features

- **Stateful Execution:** Every command run through `jun` is tracked, and its output is logged.
- **Background Process Management:** Easily run long-running tasks (like `tsc --watch`) and manage them with simple commands.
- **Persistent History:** All tasks, whether completed or running, are saved in a history that can be inspected.
- **Full I/O Logging:** Captures `stdout` and `stderr` for every task, perfect for debugging and auditing.
- **Filesystem Backend:** Uses a simple and transparent `.jsonl` format in a local `.jun` directory, making it easy to inspect or backup.
- **Dual Interface:** Can be used both as a global CLI tool and as a Deno module in your projects.

## Installation

To use `jun` as a global command-line tool, install it directly from JSR:

```sh
deno install -A jsr:@jixo/jun/cli --name jun
```

This will install the `jun` executable in your Deno installation's `bin` path.

## CLI Usage

### `jun init`

Initializes a `.jun` directory in the current working directory. This directory will be used to store all task metadata and logs for the project. If a local `.jun` is not found, `jun` will fall back to a global `~/.jun` directory.

```sh
jun init
# Output: Jun directory initialized at: /path/to/your/project/.jun
```

### `jun run <command> [args...]`

Executes a shell command, proxies its stdio, and logs everything.

```sh
# Run a simple command
jun run echo "Hello, Jun!"

# Run a long-running process (e.g., a file watcher)
# The process will continue to run, and `jun` will exit once it's started.
# You can then use `jun ls` to see it running.
jun run tsc --watch
```

### `jun ls [--json]`

Lists all currently **running** tasks.

```sh
jun ls
# PID   STATUS      START_TIME          COMMAND
# ---   ------      ----------          -------
# 2     running     2025-08-27 10:30:00   tsc --watch

# Get the output in JSON format
jun ls --json
```

### `jun history [--json]`

Lists the history of **all** tasks (running, completed, killed, etc.), sorted by the most recent.

```sh
jun history
# PID   STATUS      START_TIME          COMMAND
# ---   ------      ----------          -------
# 2     running     2025-08-27 10:30:00   tsc --watch
# 1     completed   2025-08-27 10:29:00   echo "Hello, Jun!"
```

### `jun cat <pid...>`

Displays the detailed metadata and full `stdio` log for one or more tasks.

```sh
jun cat 1
# --- Log for PID 1: echo Hello, Jun! ---
# [10:29:00.123][stdout] Hello, Jun!
```

### `jun rm <pid...> | --all | --auto`

Removes tasks and their associated logs from the history.

- `jun rm 1 3`: Removes tasks with PID 1 and 3.
- `jun rm --all`: Removes all **finished** (not running) tasks.
- `jun rm --auto`: Removes all finished tasks except for the 10 most recent ones.

```sh
jun rm 1
# Output: Removed 1 task(s).
```

### `jun kill <pid...> | --all`

Stops one or more running background tasks.

- `jun kill 2`: Stops the task with PID 2.
- `jun kill --all`: Stops **all** currently running tasks.

```sh
jun kill 2
# Output: Killed 1 task(s).
```

## Programmatic API Usage

You can also use `jun`'s core logic directly in your Deno projects.

```typescript
import {junRunLogic, junHistoryLogic, junCatLogic} from "jsr:@jixo/jun";

// Note: Ensure a .jun directory is initialized first.
// In your app's setup:
// import { junInitLogic } from "jsr:@jixo/jun";
// await junInitLogic();

// Run a command and wait for it to complete
const exitCode = await junRunLogic("ls", ["-la"]);
console.log(`Command finished with exit code: ${exitCode}`);

// Get the history
const allTasks = await junHistoryLogic();
console.log("All tasks:", allTasks);

// Get the log for the most recent task
if (allTasks.length > 0) {
  const lastTaskPid = allTasks.pid;
  const {success} = await junCatLogic([lastTaskPid]);
  console.log(`Logs for task ${lastTaskPid}:`, success[lastTaskPid]);
}
```

## License

MIT

// JIXO_CODER_EOF
