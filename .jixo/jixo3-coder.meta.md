感谢，我已经review并合并了你的代码。

注意我没有全盘接受你的代码，你的有些变更已经破坏到原本的逻辑了，因此我对你的提交做了一定的过滤。

同时有些文件体积可能过大，我看到你在给我的代码中都已经开始做一些“省略”了，我反对你输出省略，但是我手动补全了这些省略，同时我也意识到这些省略对你来说已经是一些负担了，所以我对代码做了一定的拆分，来减少你输出的负担。

另外我对代码做了一些补充

以下是最新代码：

[`next/src/**/*.ts`](@FILE)

接下来，我们就按照你之前的计划接着完善我们的代码吧。

另外我有一个要求：
我发现你在使用agent的时候，特别是planner这个Agent，你虽然定义了它的输出格式，但是这种格式是非结构化的，是在提示词中去约束的。
这并不是最佳实践，因为mastra官方其实给了结构化输出的能力：

```ts
const schema = {
  type: "object",
  properties: {
    summary: {type: "string"},
    keywords: {type: "array", items: {type: "string"}},
  },
  additionalProperties: false,
  required: ["summary", "keywords"],
};

const response = await myAgent.generate(
  [
    {
      role: "user",
      content: "Please provide a summary and keywords for the following text: ...",
    },
  ],
  {
    output: schema,
  },
);

console.log("Structured Output:", response.object);
```

可能是我给你的资料中缺乏这部分的文档是吗？还是有这个文档，只是你没注意？如果是你的失误，请务必review文档，挖掘更多的最佳实践。如果不是你的失误，那么也没关系，我来负责最终代码的质量把控。

