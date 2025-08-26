import {getJunDir, readMeta} from "../state.ts";
import type {JunTask} from "../types.ts";

export async function junHistoryLogic(): Promise<JunTask[]> {
  const junDir = await getJunDir();
  const tasks = await readMeta(junDir);
  return [...tasks.values()].sort((a, b) => b.pid - a.pid);
}

// JIXO_CODER_EOF
