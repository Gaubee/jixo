import {defineConfig} from "vitest/config";

export default defineConfig(({mode}) => {
  // mode defines what ".env.{mode}" file to choose if exists
  process.loadEnvFile();

  return {
    test: {
      env: process.env,
    },
  };
});
