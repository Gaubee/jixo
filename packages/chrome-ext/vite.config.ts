import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {resolve} from "path";
import {defineConfig} from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: "public",
  server: {
    port: 17500,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // The popup is now our HTML entry point.
        popup: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background.ts"),
        "content-script": resolve(__dirname, "src/content-script.ts"),
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
  plugins: [tailwindcss(), react({include: /\.(mdx|js|jsx|ts|tsx)$/})],
});
