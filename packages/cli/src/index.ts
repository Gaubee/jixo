process.removeAllListeners("warning");
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {runCli} from "./runCli.js";
export * from "./runCli.js";

export type AnyImportMeta = typeof import_meta_ponyfill extends (x: infer T) => any ? T : never;
export const tryRunCli = (importMeta: AnyImportMeta, args?: string[]) => {
  if (import_meta_ponyfill(importMeta).main) {
    runCli(args);
  }
};

tryRunCli(import.meta);
