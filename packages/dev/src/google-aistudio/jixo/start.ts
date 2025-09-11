import {blue, bold, gray} from "@gaubee/nodekit";
import path from "node:path";
import {startWsServer} from "./ws-server.js";

export interface StartOptions {
  workDir: string;
  force?: boolean;
}

export const doStart = async ({workDir, force}: StartOptions) => {
  const absoluteWorkDir = path.resolve(workDir);
  console.log(blue(`JIXO starting up in workspace: ${bold(absoluteWorkDir)}`));

  // Start the WebSocket server.
  await startWsServer();

  console.log(gray("\nJIXO services are running. Press Ctrl+C to exit."));
};
