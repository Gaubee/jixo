import {assetsResolver} from "@jixo/dev/utils/resolver";
import {existsSync, realpathSync} from "node:fs";
import { symlink, unlink } from "node:fs/promises";
import path from "node:path";
import {setTimeout} from "node:timers/promises";
import {defineConfig, type UserConfig} from "tsdown";

export default defineConfig(() => {
  return {
    entry: "./src/index.ts",
    outDir: "./bundle",
    format: "esm",
    noExternal: /./,
    dts: false,
    minify: false,
    external: ["@parcel/watcher"],
    ignoreWatch: [/[\\/]assets[\\/]/,/[\\/]bundle[\\/]/,/[\\/]dist[\\/]/] as any,
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
  } satisfies UserConfig;
});
