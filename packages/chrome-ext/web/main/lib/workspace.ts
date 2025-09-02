import {createStore, get, set} from "idb-keyval";

const customStore = createStore("jixo-db", "jixo-store");

export async function storeWorkspaceHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  if (await verifyPermission(handle)) {
    await set("workspaceHandle", handle, customStore);
  } else {
    throw new Error("Permission to access the directory was not granted.");
  }
}

export async function getWorkspaceHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const handle = await get<FileSystemDirectoryHandle>("workspaceHandle", customStore);
  if (handle && (await verifyPermission(handle))) {
    return handle;
  }
  return undefined;
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
