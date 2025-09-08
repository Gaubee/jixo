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
