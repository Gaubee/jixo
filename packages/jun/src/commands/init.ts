import {ensureDir, ensureFile} from "@std/fs";
import {resolve} from "@std/path";
import {getMetaPath} from "../state.ts";

export async function junInitLogic(): Promise<string> {
  const junDir = resolve(Deno.cwd(), ".jun");
  await ensureDir(junDir);
  await ensureDir(resolve(junDir, "logs"));
  await ensureFile(getMetaPath(junDir));
  return junDir;
}

// JIXO_CODER_EOF
