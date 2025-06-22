import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../../package.json" with {type: "json"};
export const server = new McpServer({
  name: "secure-filesystem-server",
  version: pkg.version,
});
