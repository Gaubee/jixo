import {blue, createResolverByRootFile, cwdResolver, green} from "@gaubee/nodekit";
import {parseArgs} from "@std/cli/parse-args";
import {import_meta_ponyfill} from "import-meta-ponyfill";
import {readFileSync, watch, writeFileSync} from "node:fs";
import path from "node:path";
const rootResolver = createResolverByRootFile(import.meta.url);
const gen_prompt = async (input: string, output: string) => {
  const inputContent = readFileSync(input, "utf8");
  const ouputContent = inputContent
    ///
    .replace(/@#([\w\.\-]+\.md)/g, (_, filename) => {
      try {
        return "````md\n" + readFileSync(rootResolver("packages/cli/prompts", filename), "utf8") + "\n````";
      } catch (e) {
        return _;
      }
    });
  writeFileSync(output, ouputContent);
  console.log(blue(new Date().toLocaleTimeString()), green(`✅ ${path.parse(output).name} updated`));
};

if (import_meta_ponyfill(import.meta).main) {
  const args = parseArgs(process.argv.slice(2), {boolean: ["watch"]});
  if (args._.length === 0) {
    throw new Error("Please specify the input file");
  }
  const inputFile = cwdResolver(args._[0].toString());
  const outputFile = args._[1] ? cwdResolver(args._[1].toString()) : inputFile.replace(/\.md$/, ".gen.md");
  gen_prompt(inputFile, outputFile);
  if (args.watch) {
    watch(inputFile, () => gen_prompt(inputFile, outputFile));
  }
}
