import path from "node:path";
import {mastra} from "./index.js";
// --- Main Execution Block ---
async function main() {
  console.log("JIXO V3 Core Services Initialized. Starting Master Workflow...");
  const masterRun = mastra.getWorkflow("jixoMasterWorkflow").createRun();
  const result = await masterRun.start({
    inputData: {
      jobName: "jixo-v3-demo",
      jobGoal: "Create a simple 'hello world' nodejs project and run it.",
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

process.loadEnvFile(path.resolve(import.meta.dirname, "../../.env"));
main();

// import {describe, it} from "vitest";
// describe("jixoMasterWorkflow", () => {
//   it(async () => {
//     await main();
//   });
// });
