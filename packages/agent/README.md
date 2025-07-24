# @jixo/agent

JIXO-AI 智能体

## Install

> **请务必安装 [pnpm](https://pnpm.io/installation)**

```shell
pnpx jixo
```

## Usage

1. 执行 `pnpx jixo` 就可以查看帮助文档、检测环境要求。
   > **请根据环境要求安装必要依赖**
2. 用 `pnpx jixo init [dir]` 就可以初始化。
   1. 可以到 `.jixo/` 文件夹下创建 `*.task.md` 文件，每一个文件都是一个AI任务执行者。
   1. init之后会有一个 `.jixo.env` 的文件。里头可以配置模型，配了哪个 API_KEY 就会自动启用哪个模型
   1. 或者也可以在 `.jixo/*.task.md` 文件的顶部的元数据里手动指定模型，比如 `model: gemini-2.0-flash`
3. 用 `pnpx jixo run [-D dir] [filter..]` 就可以让AI助手开始工作。
   1. 比如 `pnpx jixo run a b` 就是执行 a b 两个任务。
   1. 比如 `pnpx jixo run a b ./c` 就是执行 a b 任务，并且和 c 目录有关的所有任务。
