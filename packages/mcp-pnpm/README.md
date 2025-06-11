# MCP pnpm Tool

[English](./README.md) | [中文](./README_zh.md)

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-brightgreen.svg)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/--typescript?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)

**MCP pnpm Tool** is a server that implements the Model Context Protocol (MCP), providing a safe, flexible, and richly described set of tools for interacting with [pnpm](https://pnpm.io/), the fast, disk space-efficient package manager.

Designed specifically for AI agents and automated development workflows, this tool allows an AI to manage Node.js project dependencies, run scripts, and create new projects through a standardized MCP interface.

## ✨ Features

- **🤖 AI-Friendly**: Provides detailed `description` and `annotations` for each tool, enabling AI agents to accurately understand its purpose, parameters, and behavior (e.g., read-only, idempotent).
- **🛡️ Security First**: Implements a strict security check for the `pnpm run` command, only allowing the execution of scripts explicitly defined in the project's `package.json`.
- **📂 Directory-Aware**: All tools support a `cwd` (Current Working Directory) parameter, allowing precise command execution in any specified directory, which is crucial for monorepos.
- **🧩 Highly Flexible**: Every tool includes an `extraArgs` parameter to pass any pnpm CLI argument, ensuring maximum flexibility and forward-compatibility with future pnpm features.
- **🚀 Strictly-Typed API**: Built with `@modelcontextprotocol/sdk`'s `registerTool` method, providing strict input and output schemas for reliable interactions.
- **🧪 Fully Tested**: Comes with a comprehensive unit test suite to ensure the correctness and stability of the core logic.

## 🚀 Quick Start for Users

To use this tool with an MCP-compatible client (like [Claude for Desktop](https://claude.ai/download), [VS Code](https://code.visualstudio.com/), [Warp](https://www.warp.dev/), etc.), you need to add its configuration to your client's settings.

### Prerequisites

You must have [Node.js](https://nodejs.org/) and `npx` (which is included with npm) installed on your system.

### Configuration

Add the following JSON configuration to your MCP client's settings file (e.g., `claude_desktop_config.json` for Claude Desktop, or your VS Code settings). This configuration tells the client how to launch the `pnpm-tool` server.

<Note>
The `pnpm-tool` server will be automatically downloaded and run by `npx` the first time it's used.
</Note>

```json
{
  "mcpServers": {
    "pnpm": {
      "command": "npx",
      "args": ["-y", "@jixo/mcp-pnpm"]
    }
  }
}
```

## 🛠️ Tool API Documentation

This server exposes the following tools to an MCP client. All tools support the `cwd` and `extraArgs` common parameters.

### Common Parameters

- `cwd` (string, optional): The working directory to run the command in. If not provided, it runs in the current directory.
- `extraArgs` (string[], optional): An array of strings for any additional command-line arguments to pass directly to pnpm (e.g., `['--reporter=json']`).

---

### 1. `install`

- **Title**: Install Project Dependencies
- **Description**: Installs all dependencies for a project. This is equivalent to running `pnpm install`. It's the primary command for setting up a repository after cloning.
- **Annotations**: `readOnlyHint: false`, `destructiveHint: false`
- **Parameters**:
  - `frozenLockfile` (boolean, optional): If `true`, pnpm doesn't generate a lockfile and fails if the lockfile is out of sync (`--frozen-lockfile`). Essential for CI environments.
  - `production` (boolean, optional): If `true`, only production dependencies will be installed (`--prod`).

---

### 2. `add`

- **Title**: Add Packages to Dependencies
- **Description**: Adds one or more packages to the `dependencies`, `devDependencies`, or `optionalDependencies` of a project.
- **Annotations**: `readOnlyHint: false`, `destructiveHint: false`
- **Parameters**:
  - `packages` (string[], **required**): An array of packages to add. Can include versions and JSR specifiers, e.g., `['react', 'vitest@latest', 'jsr:@scope/pkg']`.
  - `dev` (boolean, optional): Install as a development dependency (`-D`).
  - `optional` (boolean, optional): Install as an optional dependency (`-O`).
  - `filter` (string, optional): Target a specific project in a workspace (`--filter <name>`).

---

### 3. `run`

- **Title**: Run a Project Script
- **Description**: Executes a script defined in the project's `package.json` file. This is the standard way to run build steps, tests, or other custom project commands.
- **Annotations**: `readOnlyHint: false`, `destructiveHint: true` (A 'clean' script could be destructive).
- **Parameters**:
  - `script` (string, **required**): The name of the script to execute from the `scripts` section of `package.json`.
  - `args` (string[], optional): Arguments to be passed to the executed script. They will be appended after `--`.
  - `filter` (string, optional): In a workspace, run the script only in the specified project.

---

### 4. `dlx`

- **Title**: Download and Execute a Package
- **Description**: Fetches a package from the registry and runs its default command binary. Useful for running one-off commands without installing packages globally, e.g., `pnpm dlx cowsay`.
- **Annotations**: `readOnlyHint: false`, `openWorldHint: true`.
- **Parameters**:
  - `command` (string, **required**): The package and command to execute, e.g., `'cowsay "Hello MCP!"'` or `'create-vite@latest my-app'`.

---

### 5. `create`

- **Title**: Create a New Project
- **Description**: Creates a new project from a starter kit or template. This is a shorthand for `pnpm dlx create-<template>`.
- **Annotations**: `readOnlyHint: false`, `openWorldHint: true`.
- **Parameters**:
  - `template` (string, **required**): The name of the starter kit, e.g., `'vite'`, `'react-app'`.
  - `extraArgs`: Use to pass additional arguments to the creator, such as the project name or template options `['my-app', '--template', 'react']`.

---

### 6. `licenses`

- **Title**: List Package Licenses
- **Description**: Checks and lists the licenses of installed packages. It can output in a human-readable or JSON format.
- **Annotations**: `readOnlyHint: true`.
- **Parameters**:
  - `json` (boolean, optional): If `true`, outputs the license information as a JSON object.
  - `dev` (boolean, optional): If `true`, only checks development dependencies.
  - `production` (boolean, optional): If `true`, only checks production dependencies.

## 💻 Local Development & Testing

This section is for contributors who want to modify or extend the `mcp-pnpm-tool`.

### Development Environment

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```
2.  **Start the build in watch mode**:
    ```bash
    pnpm run build --watch
    ```
    This will start the TypeScript compiler and automatically recompile on file changes.

### Running Tests

This project uses the built-in Node.js test runner (`node:test`) and mocks external dependencies to ensure tests are fast and reliable.

To run the full test suite, execute:

```bash
pnpm test
```

This command will first compile the code, then execute all `*.test.js` files in the `dist/test/` directory.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
