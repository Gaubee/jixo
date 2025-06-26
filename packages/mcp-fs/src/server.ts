import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {state} from "./state.js";
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
import {readOnlyPermissions, type MountPoint} from "./types.js";

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

export async function startServer(mountPoints: MountPoint[], readOnly?: boolean) {
  // Initialize global server state
  state.mountPoints = mountPoints.map((mp) => (readOnly ? {...mp, permissions: readOnlyPermissions} : mp));
  if (state.mountPoints.length > 0) {
    state.cwd = state.mountPoints[0].realPath;
  } else {
    state.cwd = process.cwd();
  }

  const transport = new StdioServerTransport();
  const server = readOnly ? readOnlyServer : readWriteServer;
  const mode = readOnly ? "Read-only" : "Read-write";

  await server.connect(transport);

  console.error(`Secure MCP Filesystem Server running on stdio in ${mode} mode.`);

  if (state.mountPoints.length > 0) {
    console.error("Mounted paths:");
    state.mountPoints.forEach((mp: MountPoint) => {
      const drive = mp.drive ? ` ($${mp.drive})` : "";
      console.error(`- [${mp.permissions}]${drive}: ${mp.rawPath}`);
    });
    console.error(`Current working directory (CWD): ${state.cwd}`);
  } else {
    console.error("Warning: No mount points specified. Access is not sandboxed.");
  }
}
