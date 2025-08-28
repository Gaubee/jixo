// Using a simple and robust IndexedDB wrapper library.
// The user needs to add this dependency: `pnpm add idb-keyval`
import {createStore, get, set} from "idb-keyval";

// Create a custom store for our application to avoid key collisions.
const customStore = createStore("jixo-db", "jixo-store");

export async function storeWorkspaceHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  // Before storing, we need to ensure we can re-acquire the handle later.
  // This requires checking and potentially requesting permission.
  if (await verifyPermission(handle)) {
    await set("workspaceHandle", handle, customStore);
  } else {
    throw new Error("Permission to access the directory was not granted.");
  }
}

export async function getWorkspaceHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const handle = await get<FileSystemDirectoryHandle>("workspaceHandle", customStore);
  if (handle) {
    if (await verifyPermission(handle)) {
      return handle;
    }
  }
  return undefined;
}

// Helper function to verify and request permissions if needed.
async function verifyPermission(handle: FileSystemDirectoryHandle) {
  const options = {mode: "readwrite" as const};
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }
  if ((await handle.requestPermission(options)) === "granted") {
    return true;
  }
  return false;
}
