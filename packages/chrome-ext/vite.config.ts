import {createResolver} from "@gaubee/nodekit";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import {defineConfig, type UserConfig} from "vite";
// import webExtension from "vite-plugin-web-extension";
const resolver = createResolver(import.meta.dirname);

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  process.env.NODE_ENV = mode;

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
          "content-script/isolated": resolver("web/isolated/index.ts"),
          "content-script/main": resolver("web/main/index.ts"),
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
      (() => {
        return {
          name: "update-version",
          closeBundle() {
            const manifest = JSON.parse(fs.readFileSync("./dist/manifest.json", "utf-8"));
            const {version} = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
            manifest.version = version;
            fs.writeFileSync("./dist/manifest.json", JSON.stringify(manifest, null, 2));
          },
        };
      })(),
      // webExtension({manifest: "./public/manifest.json"}),
    ],
    resolve: {
      alias: {
        "@": resolver("./src"),
      },
      dedupe: ["react", "react-dom"],
    },
  } satisfies UserConfig;
});
