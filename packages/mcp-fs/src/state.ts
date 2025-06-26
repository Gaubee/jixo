import type {ServerState} from "./types.js";

/**
 * Global state for the filesystem server, including mount points and current working directory.
 */
export const state: ServerState = {
  mountPoints: [],
  cwd: "",
};
