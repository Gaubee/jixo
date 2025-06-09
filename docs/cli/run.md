# run

Runs JIXO tasks based on the provided filters.

## Usage

```bash
jixo run [filter...]
```

- `filter`: Filters tasks by name or directory. You can specify multiple filters.
  - To filter by name, provide the task name directly (e.g., `my-task`).
  - To filter by directory, provide a path starting with `./` (e.g., `./scripts`).
- `-D, --dir`: Specifies the project directory containing the `jixo.config.json` file. Defaults to the current directory.

This command executes JIXO tasks based on the provided filters. It loads the `jixo.config.json` file from the specified directory and runs the tasks that match the specified filters.

## How it Works

The `run` command performs the following steps:

1.  **Loads Configuration:** Loads the `jixo.config.json` file from the specified directory to retrieve the task definitions and settings.
2.  **Resolves AI Tasks:** Resolves the AI tasks based on the configuration, identifying the tasks that are available for execution.
3.  **Finds Changed Files:** Identifies the files that have changed since the last commit, allowing JIXO to focus on the relevant files for each task.
4.  **Executes Tasks:** Executes the AI tasks, providing them with the relevant files and context to perform their functions.
