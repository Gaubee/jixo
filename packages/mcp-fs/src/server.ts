import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import {config} from "./fs-utils/config.js";
import {expandHome} from "./fs-utils/path-validation.js";
import {copy_path_tool} from "./tools/copy_path_tool.js";
import {create_directory_tool} from "./tools/create_directory_tool.js";
import {delete_path_tool} from "./tools/delete_path_tool.js";
import {edit_file_tool} from "./tools/edit_file_tool.js";
import {get_file_info_tool} from "./tools/get_file_info_tool.js";
import {list_allowed_directories_tool} from "./tools/list_allowed_directories_tool.js";
import {list_directory_tool} from "./tools/list_directory_tool.js";
import {move_file_tool} from "./tools/move_file_tool.js";
import {read_file_tool} from "./tools/read_file_tool.js";
import {search_files_tool} from "./tools/search_files_tool.js";
import {readOnlyServer, readWriteServer} from "./tools/server.js";
import {write_file_tool} from "./tools/write_file_tool.js";

export const readonlyTools = {
  read_file: read_file_tool,
  list_directory: list_directory_tool,
  get_file_info: get_file_info_tool,
  search_files: search_files_tool,
  list_allowed_directories: list_allowed_directories_tool,
};
export const readwriteTools = {
  ...readonlyTools,
  write_file: write_file_tool,
  edit_file: edit_file_tool,
  create_directory: create_directory_tool,
  move_file: move_file_tool,
  copy_path: copy_path_tool,
  delete_path: delete_path_tool,
};

export async function startServer(dirs: string[], readOnly: boolean) {
  if (dirs.length > 0) {
    config.allowedDirectories = dirs.map((dir) => {
      const expanded = expandHome(dir);
      return path.resolve(expanded);
    });
  }

  const transport = new StdioServerTransport();
  const server = readOnly ? readOnlyServer : readWriteServer;
  const mode = readOnly ? "Read-only" : "Read-write";

  await server.connect(transport);

  console.error(`Secure MCP Filesystem Server running on stdio in ${mode} mode.`);
  if (config.allowedDirectories.length > 0) {
    console.error("Allowed directories:", config.allowedDirectories);
  } else {
    console.error("Warning: No directory restrictions specified. Access is not sandboxed.");
  }
}
