import {KeyValStore} from "@jixo/dev/idb-keyval";

const workspaceStore = new KeyValStore<FileSystemDirectoryHandle>("jixo-workspace");

export async function storeWorkspaceHandle(sessionId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  if (await verifyPermission(handle)) {
    await workspaceStore.set(sessionId, handle);
  } else {
    throw new Error("Permission to access the directory was not granted.");
  }
}

export async function getWorkspaceHandle(sessionId: string): Promise<FileSystemDirectoryHandle | undefined> {
  const handle = await workspaceStore.get(sessionId);
  if (handle && (await verifyPermission(handle))) {
    return handle;
  }
  return undefined;
}

export async function unsetWorkspaceHandle(sessionId: string): Promise<void> {
  await workspaceStore.del(sessionId);
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
