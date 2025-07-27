# @jixo/cli

AI 工具集

## `jixo G` 命令使用简介

1.  `jixo G [dir] [--watch]` 用于监听一个文件夹里的 `*.meta.md` 文件，用于生成 `*.meta.gen.md` 文件
1.  `jixo G` 的目的是让开发者**高效地编写提示词**，将上下文信息整理到md文件中。
1.  通常来书，对于一个项目（代号xxx），我至少会有3个文件：
    1. `xxx.meta.md` 用来提供系统提示词
    2. `xxx-start.meta.md` 用来提供第一次与AI对话的
    3. `xxx-coder.meta.md` 用来与AI进行常规对话
1.  `*.meta.md` 的一些语法和功能：
    1. 会自动移除markdown注释。
       - 这点对于`xxx-coder.meta.md`来说非常重要，因为我会使用`xxx-coder.meta.md`的注释来存放历史记录。
       - 有这些历史记录中，方便快速编写新的提示词。
       - 这种基于单文件的，会比直接记录聊天框的操作高效很多。
    2. `[path_or_glob](@INJECT)` 注入一个或者多个文件内容。用于将多个md文件组合成一个md文件。
    3. `[path_or_glob](@FILE)` 注入一个或者多个文件，但是会有coder包裹起来。用于将文件、代码包裹在md文件中向AI进行提供
    4. `[path_or_glob](@FILE_TREE)` 用来提供一个文件树信息。适合向AI提供一整个项目的文件列表信息。比如你是前端项目，会有很多图片文件，有了这个文件树信息，AI在帮你写代码的时候，就能书写正确的文件路径
    5. `@INJECT @FILE @FILE_TREE` 默认都是遵守 gitignore 标准的，所以放心使用。
    6. `[path_or_glob](@GIT_FILE)` 类似`(@FILE)`，不同的是基于“用户Git工作空间”的视角。
       > 比如你一个文件夹`a/b/c/`里面有10个文件，你只修改了一个`d.js`文件。
       > 那么`[a/b/c/**](@GIT_FILE)`只会列出 `d.js`这个文件的内容。
       > 对比`[a/b/c/**](@FILE)` 是会列出所有10个文件的内容。
    7. `[path_or_glob](@GIT_DIFF)` 类似`[path_or_glob](@GIT_FILE)`的工作原理，同样基于“用户Git工作空间”的视角。
       > 不同的是，它是生成diff格式的内容，而不是完整的文件内容。
       > 因此适用于描述一个大文件里的一些小变更。
    8. `[commit:path_or_glob](@GIT_FILE)`类似`(@FILE)`，不同的是基于“用户Git历史记录”的视角。
       > 比如`[HEAD:**](@GIT_FILE)` 可以提供上一次提交的所有内容
       > 通常的用法是，AI做不好的东西，我自己做好了，然后就独立做了这个commit，然后将这些特别的变更内容通过这种方式快速提供给AI。
       > 还有一种特别的用法，就是可以用来获取一些你已经删除的文件。
    9. `[commit:path_or_glob](@GIT_DIFF)`类似`[commit:path_or_glob](@GIT_FILE)`的工作原理，同样基于“用户Git历史记录”的视角。
    10. 一些特殊的`path_or_glob`（目前只有一个）:
        1. `[jixo:coder](@INJECT)`: 使用jixo提供的“编程”提示词，进行协同编码
           > 我一定是将这段填写到 `xxx.meta.md` 的顶部的。
           > 这个提示词可以让AI进行大规模的项目开发，针对复杂需求生成大量代码。
           > 当然，代码质量的好坏取决于模型本身的编程能力。
        2. TODO:`[jixo:memory](@INJECT)`: 使用jixo提供的“记忆”提示词，自动梳理记忆成书
1.  可以看到，以上这些语法工具目的都是在解决“上下文生成”的需求。回看我个人的习惯，加强认知：
    1. 我自己会在`xxx.meta.md`系统提示词中提供 “规范、约束、目标、记忆”
       1. `[jixo:coder](@INJECT)` 已经提供了对话的 “规范、约束”
       2. 目标和记忆通常是我自己整理的，对于复杂的项目是需要的，对于开发一个组件什么的这种小需求，就完全不需要。
          > 所以我计划提供agent来专门做这部分的自动化
    2. 我会在`xxx-start.meta.md`中将开发需要的必要代码文件提供。
       1. 主要是项目要修改的文件、还有整体的文件数
       2. 如果是大型项目，那么要从分利用AI的幻觉:
          > 比如你的目标是开发 `@xxx/a`，但是它依赖了 `@xxx/b`，同时你不打算修改`@xxx/b`。
          > 如果你的`@xxx/a`中已经有`@xxx/b`的一些接口使用的用例，那么你就完全不需要提供`@xxx/b`的用法。
          > 只给`@xxx/a`的代码就够了，你要相信AI的幻觉。
    3. 我会在`xxx-coder.meta.md`做一些资料的整理，并附上一些终端的信息，比如：

       ````md
       谢谢，我review并修复了你提交的代码：

       [`**/*.{json,ts,mts}`](@GIT_DIFF)

       目前tsc报错如下：

       ```
       [02:32:29] File change detected. Starting incremental compilation...

       bfm-rwa-e2e-tests/product-submission.e2e.test.ts:3:30 - error TS2307: Cannot find module '../bfm-rwa-hub-service/src/app.debug.mts' or its corresponding type declarations.

       3 import { startTestHub } from "../bfm-rwa-hub-service/src/app.debug.mts";
                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

       [02:32:29] Found 1 error. Watching for file changes.
       ```
       ````

       jixo-coder会自动对比你最新提供代码信息，然后自动学习总结出你的技巧。接着它也知道修复tsc错误。

## `jixo A` 命令使用简介

1. `jixo A [some-md-files] [-G]` 基于`jixo:coder`相应的内容，来将这些内容作用到本地文件夹
1. 默认情况下`jixo A`使用prettier进行代码格式化，如果你的项目不是使用prettier，应该关闭`jixo A -F=false`。
   > 未来我会通过配置来自定义格式化的能力
1. `some-md-files`是指传入一个md文件路径或者一个glob代表多个文件。
   > eg: `pnpm A ".ai/8*.md"` 意味着把8开头的md文件按照文件名顺序处理了。
1. `-G`参数是用于做一个git-commit，因为`jixo:coder`会让AI生成代码之前先做一个git-commit作为工作计划。
   - 我通常会开启这个参数，它只会提交AI修改的文件，对于本地你自己修改的其它文件是不会提交的。
   - 所以我就能在github-desktop这个软件中，直接查看最后一次提交，就能看到AI修改的内容。
   - 如果不满意，直接undo就行了。

## `jixo go` 命令使用简介

### 概述

`jixo go` 提供了一些基于 aistudio.google.com 站点进行交互的工具。

1. `jixo go init [dir]` 初始化一个工作空间

2. `jixo go browser [dir]` 为工作空间提供 function-call 的调配

   > 建议使用deno进行开发
   1.

3. `jixo go sync` 用于将 `*.contents.json` 解构成 `jixo A` 所需的md文件。

### `jixo go init [dir]`

1. 执行`jixo go init [dir]` 初始化一个工作空间
1. 这个 dir 文件夹内会出现一个 google-aistudio.browser.js 文件
1. 按下 F12 打开“开发者工具”
1. 将[`google-aistudio.browser.js`](./google-aistudio.browser.js)的内容粘贴到 Console 面板中。
1. 确保聚焦在页面中（而不是Devtools中），此时会弹出一个文件夹选择器，选中当前 dir 这个文件夹。
1. 接下来，检查你的dir文件夹，会出现一个 `*.contents.json` 的文件。
   > 这个文件就是当前与 aistudio.google.com 的所有对话数据，包括你上传的文件内容都在这个json里。

### `jixo go browser [dir]`

1. 在网页中配置 `Function Call`
   ```json
   [
     {
       "name": "get_character_details",
       "description": "根据用户请求，获取一个或多个中文汉字的详细信息，如笔顺名称、笔画SVG路径和笔画中心线坐标。支持为不同汉字查询不同类型的数据。",
       "parameters": {
         "type": "object",
         "properties": {
           "queries": {
             "type": "array",
             "description": "一个查询请求的列表。每个请求包含一个汉字和需要获取的数据类型列表。",
             "items": {
               "type": "object",
               "properties": {
                 "character": {
                   "type": "string",
                   "description": "需要查询的单个中文字符。"
                 },
                 "data_types": {
                   "type": "array",
                   "description": "需要为该字符查询的数据类型。",
                   "items": {
                     "type": "string",
                     "enum": ["order", "strokes", "medians"]
                   }
                 }
               },
               "required": ["character", "data_types"]
             }
           }
         },
         "required": ["queries"]
       }
     }
   ]
   ```

### `jixo go sync`

1. 首先需要了解 `jixo G` 和 `jixo A` 这两个命令
1. `jixo:coder` 会将一次回复拆分成多次，中间需要用户通过“继续”来让它输出。
1. 因此 `jixo go sync`命令会将md文件，基于一些`jixo:coder` 的结构特性，将AI的响应内容，生产`02-01.md`的内容
   > `02`是指回复的任务编号。
   > `01`是指这次任务的第几次回复。如果是`00`，意味着是包含“git-commit”的
1. 有了这样的文件命名，你就可以使用`jixo A 02-*.md -G` 来快速将最后一次的AI回复全部作用到本地项目中。

## QA

1. 会把 aistudio.google.com 彻底破解成 openai 兼容接口吗？
   > 理论上可行，但不打算。如果需要直接使用 [AIstudioProxyAPI](https://github.com/CJackHwang/AIstudioProxyAPI) 工具就好了。
1. jixo 的理念是什么？
   > jixo是为AI使用提供一系列的“基础工具”。之前会尝试过开发“多Agent协作体”，但是目前在设计新的架构中，之后会慢慢重启。

## TODO & PROPOSAL

> 目前有以下提案：

1. 改进`jixo go browser`，简化 function-call 的开发。做到能自动生成 function-call的配置，并自动注入到浏览器中。
1. 新增`jixo go context7`，目的是将Context7的资料自动导入到 aistudio 上下文中，作为一个问答专家，并自动生成`*.function_call.ts`文件。 这样一来，其它 aistudio 页面就可以使用 function-call 向这些问答专家询问专业知识，从而实现多专家协作模式。
   > 和基于MCP的Context7插件不一样，MCP意味着是单个上下文，那么所有的专业信息全部堆积在一个上下文中，会带来模型能力下降的问题。而JIXO倡导的是多专家协作模式，这也是目前超级Agent的一个普遍共识。
1. 打算开发`jixo M` memory-agent，将所有的通话内容整理成一本可视的书籍。用于包含最新的项目资料，以及一些历史记录的索引。
1. 开发`jixo run`（简写成 `jix`），可以用来执行命令。目的是在`jixo G`中，直接注入终端内容：
   > 比如说`jix pnpm tsc`，其实和`pnpm tsc` 没有任何区别。
   > 但tty是由jix提供，因此拦截了`pnpm tsc`的任务输出。
   > 所以可以在`*.meta.md`文件中，通过`[tsc](@RUN)`来获得终端的内容