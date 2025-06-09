# CLI Usage

The JIXO CLI provides a command-line interface for interacting with JIXO. It offers a variety of commands for initializing projects, running tasks, and managing prompts.

## Commands

### doctor

Checks the requirements for running JIXO.

```bash
jixo doctor
```

This command checks if your environment meets the necessary requirements to run JIXO. It performs checks on Node.js version, pnpm version, and other dependencies.

### init [dir]

Creates a new JIXO project in the specified directory.

```bash
jixo init [dir]
```

- `dir`: The directory to create the JIXO project. Defaults to the current directory (`./`).

This command initializes a new JIXO project by creating a `jixo.config.json` file in the specified directory. This file contains the project's configuration, including the AI model provider, task definitions, and other settings.

### run [filter...]

Runs JIXO tasks based on the provided filters.

```bash
jixo run [filter...]
```

- `filter`: Filters tasks by name or directory. You can specify multiple filters.
  - To filter by name, provide the task name directly (e.g., `my-task`).
  - To filter by directory, provide a path starting with `./` (e.g., `./scripts`).
- `-D, --dir`: Specifies the project directory containing the `jixo.config.json` file. Defaults to the current directory.

This command executes JIXO tasks based on the provided filters. It loads the `jixo.config.json` file from the specified directory and runs the tasks that match the specified filters.

### prompts

Manages JIXO prompts.

```bash
jixo prompts [options]
```

This command provides options for listing and upgrading JIXO prompts.

#### Options

- `-D, --dir`: Specifies the project directory containing the `jixo.config.json` file. Defaults to the current directory.
- `-M, --mirrorUrl`: Specifies the URL for downloading prompts from a mirror.
- `-U, --upgrade`: Upgrades the built-in prompts to the latest version.

#### Listing Prompts

To list the available prompts, run the command without any options:

```bash
jixo prompts
```

#### Upgrading Prompts

To upgrade the built-in prompts, use the `--upgrade` option:

```bash
jixo prompts --upgrade
```

## Examples

Run all tasks in the current directory:

```bash
jixo run
```

Run tasks with the name `my-task`:

```bash
jixo run my-task
```

Run tasks in the `scripts` directory:

```bash
jixo run ./scripts
```

Upgrade builtin prompts:

```bash
jixo prompts --upgrade
```