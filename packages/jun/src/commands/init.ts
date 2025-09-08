import fsp from "node:fs/promises";
import path from "node:path";
import {getMetaPath} from "../state.js";

async function ensureDir(dirPath: string) {
  try {
    await fsp.mkdir(dirPath, {recursive: true});
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "EEXIST") {
      throw error;
    }
  }
}

async function ensureFile(filePath: string) {
  try {
    await fsp.access(filePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await fsp.writeFile(filePath, "", "utf-8");
    } else {
      throw error;
    }
  }
}

export async function junInitLogic(): Promise<string> {
  const junDir = path.resolve(process.cwd(), ".jun");
  await ensureDir(junDir);
  await ensureDir(path.resolve(junDir, "logs"));
  await ensureFile(getMetaPath(junDir));
  return junDir;
}
