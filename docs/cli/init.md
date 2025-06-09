# init

Creates a new JIXO project in the specified directory.

## Usage

```bash
jixo init [dir]
```

- `dir`: The directory to create the JIXO project. Defaults to the current directory (`./`).

This command initializes a new JIXO project by creating the following files and directories:

- **`.jixo/` directory:** This directory stores JIXO-related files, such as task definitions and logs.
- **`.jixo/readme.task.md`:** This file is a task definition that JIXO uses to generate or update the project's `README.md` file.  You can customize this file to define the desired content and format of your `README.md`.
- **`jixo.config.json`:** This file contains the project's configuration, including the AI model provider, task definitions, and other settings.
- **`.jixo.env`:** This file stores environment variables used by JIXO tasks.
- **`.gitignore`:** This file is updated to ignore `.jixo.env`, `*.memory.json` and `memory.json` files, preventing them from being committed to the repository.
