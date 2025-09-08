import {getJunDir, readMeta} from "../state.js";
import type {JunTask} from "../types.js";

export async function junLsLogic(): Promise<JunTask[]> {
  const junDir = await getJunDir();
  const tasksMap = await readMeta(junDir);
  return [...tasksMap.values()].filter((t) => t.status === "running");
}
