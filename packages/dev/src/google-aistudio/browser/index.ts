import {syncInput} from "./input.js";
import {syncOutput} from "./output.js";
import {getDirHandle, setDirHandle} from "./utils.js";

let isSyncActive = false;

/**
 * Prompts the user to select a workspace directory and stores the handle.
 * This must be called in response to a user gesture (e.g., a button click).
 * @returns The handle of the selected directory.
 */
export async function selectWorkspace(): Promise<FileSystemDirectoryHandle> {
  const dirHandle = await window.showDirectoryPicker({mode: "readwrite"});
  setDirHandle(dirHandle); // Store the handle for other functions to use.
  return dirHandle;
}

/**
 * Starts the main synchronization logic between the AI Studio page and the local filesystem.
 * It requires a directory handle to have been previously set by `selectWorkspace`.
 */
export async function startSync(): Promise<{status: "SYNC_STARTED" | "ERROR"; message?: string}> {
  if (isSyncActive) {
    return {status: "ERROR", message: "Sync is already active."};
  }

  const handle = getDirHandle();
  if (!handle) {
    return {status: "ERROR", message: "Workspace not selected. Please call selectWorkspace() first."};
  }

  isSyncActive = true;
  console.log(`JIXO BROWSER: Starting sync with workspace '${handle.name}'...`);

  // These are long-running processes, so we don't await them.
  void syncOutput();
  void syncInput();

  return {status: "SYNC_STARTED"};
}
