import {import_meta_ponyfill} from "import-meta-ponyfill";
import {doGoogleAiStudioAutomation} from "./index.js";
if (import_meta_ponyfill(import.meta).main) {
  doGoogleAiStudioAutomation(process.argv[2]);
}
