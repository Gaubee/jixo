# JIXO

AI 工具集、助手

查看 [@jixo/cli](https://www.npmjs.com/package/@jixo/cli) 来进行使用

## Dev

需要打开3个终端执行三个监听任务

```shell
# 编译出 js 代码
pnpm dev

# 打包资源文件
cd packages/cli && pnpm gen-prompts --watch

# 代码和资源打包
pnpm build2 --watch
```

然后就可以执行命令了

```
pnpm jixo doctor
pnpm jixo init ./demo
pnpm jixo run -D ./demo
```
