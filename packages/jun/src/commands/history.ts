import {getJunDir, readMeta} from "../state.js";
import type {JunTask} from "../types.js";

export async function junHistoryLogic(): Promise<JunTask[]> {
  const junDir = await getJunDir();
  const tasksMap = await readMeta(junDir);
  return [...tasksMap.values()].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}
