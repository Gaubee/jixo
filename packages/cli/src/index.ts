export * from "./config";

import {import_meta_ponyfill} from "import-meta-ponyfill";
import {runCli} from "./cli";

if (import_meta_ponyfill(import.meta).main) {
  runCli();
}
