我已经尝试合并了你的代码，并做出了一些改动，但给出了一些review建议

[`next/src/**/*.ts`](@FILE)

最后的index.ts这个文件我没合并，我想你应该还没完全做完index.ts。
如果你要提供测试，应该用mastra的规范去写测试，而不是在index.ts中输入DEMO函数来做测试。

不过我查找了mastra的官方文档，我并没有找到mastra的测试规范。
我自己觉得可以创建 test.ts 文件，在这个文件里去构建 `const mastra`或者`const agent`对象，再次基础上去测试 `jobManager.getTools()`
不过你好像还没做到这一步？
