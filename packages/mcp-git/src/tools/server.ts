import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../../package.json" with {type: "json"};
import {GitWrapper} from "../git-wrapper.js";

export const server = new McpServer({
  name: "mcp-git-server",
  version: pkg.version,
});
export async function withGit<T>(repoPath: string, callback: (git: GitWrapper) => Promise<T>): Promise<T> {
  const git = new GitWrapper(repoPath);
  await git.validateRepo();
  return callback(git);
}
