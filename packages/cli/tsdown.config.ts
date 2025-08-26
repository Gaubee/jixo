import {assetsResolver} from "@jixo/dev/utils/resolver";
import {existsSync, realpathSync} from "node:fs";
import {symlink, unlink} from "node:fs/promises";
import {builtinModules} from "node:module";
import path from "node:path";
import {setTimeout} from "node:timers/promises";
import {defineConfig, type UserConfig} from "tsdown";

export default defineConfig(() => {
  return {
    entry: "./src/index.ts",
    outDir: "./bundle",
    format: "esm",
    noExternal: /./,
    sourcemap: true,
    dts: false,
    minify: false,
    platform: "node",
    external: ["@parcel/watcher"],
    ignoreWatch: [/[\\/]assets[\\/]/, /[\\/]bundle[\\/]/, /[\\/]dist[\\/]/] as any,
    hooks: {
      "build:done": async () => {
        const source = assetsResolver.dirname;
        const target = path.resolve("assets");
        let canRetry = -1;
        do {
          try {
            if (existsSync(target)) {
              const cliAssetsRealpath = realpathSync(target);
              const devAssetsRealpath = realpathSync(source);
              if (cliAssetsRealpath === devAssetsRealpath) {
                return;
              }
            }
            await unlink(target).catch(() => {});
            await symlink(source, target, "junction");
          } catch (e) {
            console.warn(canRetry, e);
            if (e instanceof Error && e.message.includes("EBUSY:")) {
              canRetry--;
              if (canRetry > 0) {
                await setTimeout(1000);
                continue;
              }
            }
            throw e;
          }
        } while (canRetry > 0);
      },
    },
    plugins: [
      {
        name: "enforce-node-protocol",
        renderChunk: (code: string) => {
          // 简单正则：把 "module"、"v8"、"fs" 等 Node 内建模块
          // 统一改成 "node:xxx"
          let replaced = code.replace(/(?<![\w.])require$["']([^"']+)["']$/g, (m, id) => (builtinModules.includes(id) && !id.startsWith("node:") ? `require("node:${id}")` : m));

          // 对 ESM 的 import 也再检查一次
          replaced = replaced.replace(/from\s+["']([^"']+)["']/g, (m, id) => (builtinModules.includes(id) && !id.startsWith("node:") ? `from "node:${id}"` : m));
          // 对 ESM 的 dynamic import 也再检查一次
          replaced = replaced.replace(/from\(["']([^"']+)["']\)/g, (m, id) => (builtinModules.includes(id) && !id.startsWith("node:") ? `from("node:${id}")` : m));
          return replaced;
        },
      },
    ],
  } satisfies UserConfig;
});
