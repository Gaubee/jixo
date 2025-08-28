import {blue, bold, gray} from "@gaubee/nodekit";
import path from "node:path";
import {doGoogleAiStudioAutomation} from "../node/index.js";
import {generateConfigTemplate} from "./config.js";
import {initTools} from "./init.js";
import {startWsServer} from "./ws-server.js";

export interface StartOptions {
  workDir: string;
  force?: boolean;
}

export const doStart = async ({workDir, force}: StartOptions) => {
  const absoluteWorkDir = path.resolve(workDir);
  console.log(blue(`JIXO starting up in workspace: ${bold(absoluteWorkDir)}`));

  // 1. Initialize tools by copying them to the workspace.
  const toolsDir = path.join(absoluteWorkDir, "tools");
  await initTools({dir: toolsDir, force});

  // 2. Scan tools and generate/update the config template.
  await generateConfigTemplate({workDir: absoluteWorkDir, toolsDir});

  // 3. Start the WebSocket server.
  await startWsServer();

  // 4. Start the main automation service, watching the workspace.
  await doGoogleAiStudioAutomation({dir: absoluteWorkDir, watch: true, toolsDir});

  console.log(gray("\nJIXO services are running. Press Ctrl+C to exit."));
};
