import {createResolver} from "@gaubee/nodekit";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import {defineConfig, type UserConfig} from "vite";
const resolver = createResolver(import.meta.dirname);

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    publicDir: "public",
    server: {
      port: 17500,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          // The sidepanel is now our HTML entry point.
          sidepanel: resolver("sidepanel.html"),
          // "content-script": resolver("web/main.tsx"),
          web: resolver("web/main.tsx"),
          "web-inject": resolver("web/inject.ts"),
          // background: resolver("service-worker/background.ts"),
        },
        output: {
          entryFileNames: `[name].js`,
          chunkFileNames: `chunks/[name].js`,
          assetFileNames: `assets/[name].[ext]`,
        },
      },
      target: "esnext",
      minify: false,
    },
    plugins: [
      tailwindcss(),
      react({include: /\.(mdx|js|jsx|ts|tsx)$/}),
      (() => {
        const bundleDirname = resolver("bundle");
        return {
          name: "copy-bundle",
          apply: "build",
          configureServer(server) {
            // 1. 让 Vite 把 bundle 当静态资源目录
            server.config.server.fs.allow.push(bundleDirname);

            // 2. 让 Vite 的 watcher 监听 bundle 目录
            server.watcher.add(bundleDirname);
          },
          closeBundle() {
            if (fs.existsSync(bundleDirname)) {
              fs.cpSync(bundleDirname, resolver("dist"), {recursive: true});
            }
          },
        };
      })(),
    ],
  } satisfies UserConfig;
});
