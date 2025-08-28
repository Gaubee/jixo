// packages/chrome-ext/src/lib/workspace.ts
// A small utility to manage the workspace handle in chrome.storage.local
import {get, set} from "idb-keyval"; // Using a simple IndexedDB wrapper

export async function storeWorkspaceHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await set("workspaceHandle", handle);
}

export async function getWorkspaceHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return await get("workspaceHandle");
}
