process.removeAllListeners("warning");
import {$} from "@gaubee/nodekit";
import {globSync, rmSync} from "node:fs";

await $.spawn("tsc", ["--build", "--clean"]);
for (const distDir of globSync("packages/*/dist")) {
  rmSync(distDir, {recursive: true, force: true});
}
