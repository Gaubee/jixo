import {red, green, cyan, yellow} from "@gaubee/nodekit";
import {safeEnv} from "../../env.js";

interface RunOptions {
  jobGoal: string;
  workDir: string;
  maxLoops: number;
  jobName?: string;
  gitCommit?: boolean;
}

export const run = async (options: RunOptions) => {
  const {jobGoal, workDir, maxLoops, jobName, gitCommit} = options;
  const coreUrl = safeEnv.JIXO_CORE_URL;
  const apiKey = safeEnv.JIXO_API_KEY;

  console.log(cyan(`🚀 Starting JIXO job...`));
  console.log(`   - Goal: ${jobGoal}`);
  console.log(`   - Target: ${coreUrl}`);

  try {
    const response = await fetch(`${coreUrl}/jixo/v1/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jobGoal,
        workDir,
        maxLoops,
        jobName,
        gitCommit,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to start job. Server responded with ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    console.log(green(`✅ Job successfully started with Run ID: ${result.runId}`));
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch failed")) {
      console.error(red("\n❌ Error: Could not connect to the JIXO Core service."));
      console.error(yellow(`   Please ensure the core service is running at ${coreUrl}.`));
      console.error(yellow(`   You can start it by running 'jixo daemon start' or running the core package directly.`));
    } else {
      console.error(red("\n❌ An unexpected error occurred:"), error);
    }
    process.exit(1);
  }
};
