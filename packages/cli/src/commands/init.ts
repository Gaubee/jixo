import {writeText} from "@gaubee/nodekit";
import {str_trim_indent} from "@gaubee/util";
import fs from "node:fs";
import path from "node:path";

export const init = (dir: string) => {
  // Create .jixo directory
  const jixoDir = path.join(dir, ".jixo");
  fs.mkdirSync(jixoDir, {recursive: true});

  // Create .jixo.env file
  const jixoEnvFilepath = path.join(dir, ".jixo.env");
  if (!fs.existsSync(jixoEnvFilepath)) {
    writeText(
      jixoEnvFilepath,
      str_trim_indent(`
        # JIXO Core Service Configuration
        JIXO_CORE_URL=http://localhost:4111
        JIXO_API_KEY=

        # LLM Provider API Keys (to be used by jixo-core)
        # ANTHROPIC_API_KEY=
        # GOOGLE_API_KEY=
        # OPENAI_API_KEY=
      `),
    );
    console.log(`✅ Created configuration template at: ${jixoEnvFilepath}`);
  }

  // Update root .gitignore
  const gitignoreFilepath = path.join(dir, ".gitignore");
  addRulesToGitIgnore(gitignoreFilepath, [".jixo.env", ".jixo/memory/"]);
  console.log(`✅ Updated .gitignore`);

  console.log("\nJIXO initialized successfully!");
};

const addRulesToGitIgnore = (gitignoreFilepath: string, rules: string[]) => {
  const existingRules = fs.existsSync(gitignoreFilepath) ? fs.readFileSync(gitignoreFilepath, "utf-8").split("\n") : [];
  let changed = false;
  const newRules = rules.filter((rule) => !existingRules.includes(rule));
  
  if (newRules.length > 0) {
    fs.appendFileSync(gitignoreFilepath, "\n# JIXO\n" + newRules.join("\n") + "\n");
    changed = true;
  }
  return changed;
};
