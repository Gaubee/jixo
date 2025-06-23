import path from "node:path";
import {createJixoApp} from "./mastra/app.js";
// --- Main Execution Block ---
async function main(workDir: string) {
  console.log("JIXO V3 Core Services Initialized. Starting Master Workflow...");
  const demoApp = await createJixoApp({workDir, logLevel: "debug"});
  const masterRun = demoApp.getWorkflow("jixoMasterWorkflow").createRun();
  const result = await masterRun.start({
    inputData: {
      jobName: "jixo-v3-demo",
      jobGoal: "Create a simple 'hello world' nodejs project and run it. 并且最终提供这个nodejs的程序路径给用户",
      workDir,
      maxLoops: 20,
    },
  });

  if (result.status === "success") {
    console.log(`\n✅ [JIXO] Master workflow finished. Final status: ${result.result.finalStatus}`);
  } else if (result.status === "failed") {
    console.error(`\n❌ [JIXO] Master workflow failed. Error: ${result.error}`);
  } else if (result.status === "suspended") {
    console.error(`\n⏳ [JIXO] Master workflow suspended.`);
  }
}
const rootDir = path.resolve(import.meta.dirname, "../");
process.loadEnvFile(path.join(rootDir, ".env"));

main(process.cwd());

// import {describe, it} from "vitest";
// describe("jixoMasterWorkflow", () => {
//   it(async () => {
//     await main();
//   });
// });
