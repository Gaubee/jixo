---
model: gemini-2.0-flash
---
在docs目录下，基于vitepress平台搭建当前项目的文档网站。

关于项目管理：

1. docs是一个独立的项目
1. 使用pnpm-workspace.yaml来统一管理这个docs项目

在网站中需要展现以下内容：

1. 详细介绍JIXO这个项目的价值，有引人注目的的内容展示
   > 特别需要需要阅读项目中的提示词，理解项目的目标和展望
2. 目前CLI的使用方法
   > 需要充分阅读 [packages/cli/src/cli.ts]() 这个文件
