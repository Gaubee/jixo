import {RuntimeContext} from "@mastra/core/runtime-context";
import path from "node:path";
import {JixoApp, jixoAppConfigFactory} from "./mastra/app.js";
// --- Main Execution Block ---
async function main(workspaceDir: string) {
  console.log("JIXO V3 Core Services Initialized. Starting Master Workflow...");
  const config = await jixoAppConfigFactory({appName: "jixo-v3-demo", workspaceDir});
  const demoApp = new JixoApp(config);

  const masterRun = await demoApp.getWorkflow("jixoMasterWorkflow").createRunAsync();

  const runtimeContext = new RuntimeContext();
  runtimeContext.set("workspaceManager", demoApp.workspaceManager);

  const result = await masterRun.start({
    inputData: {
      jobName: "jixo-v3-demo",
      jobGoal: "Create a simple 'hello world' nodejs project and run it. 并且最终提供这个nodejs的程序路径给用户",
      jobDir: workspaceDir,
      maxLoops: 20,
    },
    runtimeContext,
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
