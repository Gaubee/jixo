import {createStore, del, get, set} from "idb-keyval";

const workspaceStore = createStore("jixo-workspace", "store");

export async function storeWorkspaceHandle(sessionId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  if (await verifyPermission(handle)) {
    await set(sessionId, handle, workspaceStore);
  } else {
    throw new Error("Permission to access the directory was not granted.");
  }
}

export async function getWorkspaceHandle(sessionId: string): Promise<FileSystemDirectoryHandle | undefined> {
  const handle = await get<FileSystemDirectoryHandle>(sessionId, workspaceStore);
  if (handle && (await verifyPermission(handle))) {
    return handle;
  }
  return undefined;
}

export async function unsetWorkspaceHandle(sessionId: string): Promise<void> {
  await del(sessionId, workspaceStore);
}

async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const options = {mode: "readwrite" as const};
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }
  if ((await handle.requestPermission(options)) === "granted") {
    return true;
  }
  return false;
}
