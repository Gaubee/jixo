import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {resolve} from "path";
import {defineConfig} from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  // The public directory will be copied to the root of the dist directory.
  // It should contain manifest.json, icons, and other static assets.
  publicDir: "public",
  server: {
    port: 17500,
  },

  build: {
    // The output directory for the build.
    outDir: "dist",
    // Empty the output directory before building.
    emptyOutDir: true,

    // Configure Rollup for multiple entry points.
    rollupOptions: {
      input: {
        // The sidepanel is an HTML entry point.
        sidepanel: resolve(__dirname, "sidepanel.html"),

        // Background and content scripts are JS entry points.
        background: resolve(__dirname, "src/background.ts"),
        "content-script": resolve(__dirname, "src/content-script.ts"),
      },
      output: {
        // Configure how the output files are named.
        // We want predictable names that match our manifest.json.
        entryFileNames: `[name].js`,
        chunkFileNames: `chunks/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
    // Set a target that supports top-level await, common in modern extensions.
    target: "esnext",
    // Disable minification for easier debugging during development.
    minify: false,
  },
  plugins: [
    //
    tailwindcss(),
    react({include: /\.(mdx|js|jsx|ts|tsx)$/}),
  ],
});
