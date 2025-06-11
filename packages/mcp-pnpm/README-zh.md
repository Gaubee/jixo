# MCP pnpm 工具

[中文](./README_zh.md) | [English](./README.md)

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-brightgreen.svg)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/--typescript?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)

**MCP pnpm Tool** 是一个实现了模型上下文协议（Model Context Protocol）的服务器，它将 [pnpm](https://pnpm.io/) 这个快速、磁盘空间高效的包管理器的核心功能，封装成了一套安全、灵活且具有丰富元数据的工具。

这个工具专门为 AI Agent 和自动化开发工作流设计，允许 AI 通过标准化的 MCP 接口来管理 Node.js 项目的依赖、运行脚本和创建新项目。

## ✨ 特性

- **🤖 AI 友好**: 为每个工具提供了详尽的 `description` 和 `annotations`，让 AI Agent 能够准确理解其用途、参数和行为（例如，只读、幂等性等）。
- **🛡️ 安全第一**: 对 `pnpm run` 命令实施了严格的安全检查，只允许执行项目 `package.json` 中明确定义的脚本，以防止任意命令执行。
- **📂 目录感知**: 所有工具均支持 `cwd` (Current Working Directory) 参数，允许在指定的工作目录下精确执行命令，这对于 monorepo 项目至关重要。
- **🧩 高度灵活**: 每个工具都包含 `extraArgs` 参数，可以传递任何 pnpm CLI 支持的参数，确保了最大的灵活性和对未来 pnpm 功能的兼容性。
- **🚀 严格类型化的 API**: 使用 `@modelcontextprotocol/sdk` 的 `registerTool` 方法构建，提供了严格的输入和输出 schema，保证了交互的可靠性。
- **🧪 完整的测试覆盖**: 附带全面的单元测试套件，确保核心逻辑的正确性和稳定性。

## 🚀 用户快速入门

要将此工具与兼容 MCP 的客户端（如 [Claude for Desktop](https://claude.ai/download)、[VS Code](https://code.visualstudio.com/)、[Warp](https://www.warp.dev/) 等）一同使用，您需要将其配置添加到您的客户端设置中。

### 先决条件

您的系统中必须安装有 [Node.js](https://nodejs.org/) 和 `npx`（npm 中已包含）。

### 配置

将以下 JSON 配置添加到您的 MCP 客户端的设置文件中（例如，Claude Desktop 的 `claude_desktop_config.json` 或您的 VS Code 设置）。此配置会告知客户端如何启动 `pnpm-tool` 服务器。

<Note>
`pnpm-tool` 服务器将在首次使用时由 `npx` 自动下载并运行。
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

## 🛠️ 工具 API 文档

本服务器向 MCP 客户端暴露以下工具。所有工具都支持 `cwd` 和 `extraArgs` 这两个通用参数。

### 通用参数

- `cwd` (string, optional): 命令执行的工作目录。如果未提供，则在当前目录中运行。
- `extraArgs` (string[], optional): 一个字符串数组，用于传递任何额外的命令行参数给 pnpm（例如 `['--reporter=json']`）。

---

### 1. `install`

- **标题**: 安装项目依赖 (Install Project Dependencies)
- **描述**: 安装项目的所有依赖项，等同于运行 `pnpm install`。这是克隆仓库后设置项目的首要命令。
- **注解**: `readOnlyHint: false` (此命令会修改文件), `destructiveHint: false` (此命令是增量式的)
- **参数**:
  - `frozenLockfile` (boolean, optional): 如果为 `true`，pnpm 不会生成 lockfile，并在 lockfile 过期时失败 (`--frozen-lockfile`)。对 CI 环境至关重要。
  - `production` (boolean, optional): 如果为 `true`，只安装生产环境依赖 (`--prod`)。

---

### 2. `add`

- **标题**: 添加包至依赖 (Add Packages to Dependencies)
- **描述**: 将一个或多个包添加到项目的 `dependencies`、`devDependencies` 或 `optionalDependencies` 中。
- **注解**: `readOnlyHint: false`, `destructiveHint: false`
- **参数**:
  - `packages` (string[], **required**): 要添加的包数组。可以包含版本和 JSR 标识符，例如 `['react', 'vitest@latest', 'jsr:@scope/pkg']`。
  - `dev` (boolean, optional): 作为开发依赖安装 (`-D`)。
  - `optional` (boolean, optional): 作为可选依赖安装 (`-O`)。
  - `filter` (string, optional): 在 monorepo 工作区中，指定要操作的目标项目 (`--filter <name>`)。

---

### 3. `run`

- **标题**: 运行项目脚本 (Run a Project Script)
- **描述**: 执行在项目 `package.json` 文件中定义的脚本。这是运行构建、测试或其他自定义项目命令的标准方式。
- **注解**: `readOnlyHint: false`, `destructiveHint: true` (一个 'clean' 脚本可能是破坏性的)。
- **参数**:
  - `script` (string, **required**): 要执行的脚本名称，该脚本在 `package.json` 的 `scripts` 部分定义。
  - `args` (string[], optional): 传递给被执行脚本的参数，它们将被附加在 `--` 之后。
  - `filter` (string, optional): 在工作区中，仅在指定的项目中运行此脚本。

---

### 4. `dlx`

- **标题**: 下载并执行包 (Download and Execute a Package)
- **描述**: 从注册表获取一个包并运行其默认的二进制命令。这对于运行一次性命令非常有用，无需全局安装包，例如 `pnpm dlx cowsay`。
- **注解**: `readOnlyHint: false`, `openWorldHint: true` (此命令会访问互联网)。
- **参数**:
  - `command` (string, **required**): 要执行的包和命令，例如 `'cowsay "Hello MCP!"'` 或 `'create-vite@latest my-app'`。

---

### 5. `create`

- **标题**: 创建新项目 (Create a New Project)
- **描述**: 从一个启动套件或模板创建一个新项目。这是 `pnpm dlx create-<template>` 的简写形式。
- **注解**: `readOnlyHint: false`, `openWorldHint: true`。
- **参数**:
  - `template` (string, **required**): 启动套件的名称，例如 `'vite'`, `'react-app'`。
  - `extraArgs`: 用于向创建工具传递额外参数，例如项目名称或模板选项 `['my-app', '--template', 'react']`。

---

### 6. `licenses`

- **标题**: 列出包许可证 (List Package Licenses)
- **描述**: 检查并列出已安装包的许可证。可以输出为人类可读格式或 JSON 格式。
- **注解**: `readOnlyHint: true` (此命令是只读的)。
- **参数**:
  - `json` (boolean, optional): 如果为 `true`，以 JSON 对象格式输出许可证信息。
  - `dev` (boolean, optional): 如果为 `true`，只检查开发依赖。
  - `production` (boolean, optional): 如果为 `true`，只检查生产依赖。

## 💻 本地开发与测试

本部分面向希望修改或扩展 `mcp-pnpm-tool` 的贡献者。

### 开发环境

1.  **安装依赖**:
    ```bash
    pnpm install
    ```
2.  **以 watch 模式启动构建**:
    ```bash
    pnpm run build --watch
    ```
    这将启动 TypeScript 编译器并监听文件变化，实现自动重新编译。

### 运行测试

本项目使用 Node.js 内置的测试运行器 (`node:test`)，并对外部依赖进行了 mock，以确保测试快速、可靠。

要运行完整的测试套件，请执行：

```bash
pnpm test
```

该命令会首先编译代码，然后执行 `dist/test/` 目录下的所有 `*.test.js` 文件。

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。
