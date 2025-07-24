import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import z from "zod";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {sync} from "./sync.js";

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["outDir"],
    boolean: ["watch"],
    alias: {
      O: "outDir",
      W: "watch",
    },
  });
  reactiveFs.use(
    async () => {
      await sync(z.string().safeParse(args._[0]).data ?? process.cwd());
    },
    {
      once: !args.watch,
    },
  );
}
