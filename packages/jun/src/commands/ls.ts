import {getJunDir, readMeta} from "../state.ts";
import type {JunTask} from "../types.ts";

export async function junLsLogic(): Promise<JunTask[]> {
  const junDir = await getJunDir();
  const tasks = await readMeta(junDir);
  return [...tasks.values()].filter((t) => t.status === "running");
}

// JIXO_CODER_EOF
