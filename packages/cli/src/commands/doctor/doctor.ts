// doctor.ts
import {blue, bold, cyan, gray, green, red, yellow} from "@gaubee/nodekit";
import {execSync} from "child_process";
import semver from "semver";

import type {DoctorConfig} from "./types.js"; // Assuming types.ts

const CHECK_MARK = green("✔");
const CROSS_MARK = red("✖");
const WARN_MARK = yellow("⚠");

export interface ToolCheckResult {
  id: string;
  displayName: string;
  exists: boolean;
  version?: string; // Actual version found
  requiredVersion?: string; // From config
  meetsVersionRequirement: boolean; // True if version >= minVersion or if minVersion not set & exists
  isOptional: boolean;
  message: string;
  installationHint?: string;
}

export interface DoctorReport {
  overallSuccess: boolean;
  results: ToolCheckResult[];
}

async function executeCommand(command: string): Promise<{stdout: string; stderr: string; error?: Error}> {
  return new Promise((resolve) => {
    try {
      const stdout = execSync(command, {encoding: "utf8", stdio: "pipe"});
      resolve({stdout, stderr: ""});
    } catch (e: any) {
      resolve({stdout: "", stderr: e.stderr || "", error: e});
    }
  });
}

export async function runDoctor(config: DoctorConfig, logger: {write: (log: string) => void} = process.stdout): Promise<DoctorReport> {
  console.log(blue(bold("🩺 Running Environment Doctor...\n")));

  const results: ToolCheckResult[] = [];
  let overallSuccess = true;

  for (const tool of config) {
    logger.write(`  Checking ${cyan(tool.displayName)}... `);

    const result: ToolCheckResult = {
      id: tool.id,
      displayName: tool.displayName,
      exists: false,
      meetsVersionRequirement: false, // Assume failure until proven otherwise
      isOptional: !!tool.optional,
      message: "",
      requiredVersion: tool.minVersion,
      installationHint: tool.installationHint,
    };

    const execResult = await executeCommand(tool.versionCommand);

    if (execResult.error || execResult.stderr.includes("command not found") || execResult.stderr.includes("not recognized")) {
      result.exists = false;
      result.message = `'${tool.id}' command not found or failed to execute.`;
      logger.write(`${tool.optional ? WARN_MARK : CROSS_MARK}\n`);
      console.log(`    ${red(result.message)}`);
      if (tool.installationHint) {
        console.log(`    ${yellow("Hint:")} ${tool.installationHint}`);
      }
    } else {
      result.exists = true;
      const output = execResult.stdout.trim();
      const match = output.match(tool.versionParseRegex);

      if (match && match[1]) {
        result.version = semver.clean(match[1]) || undefined; // Clean the version string
        if (result.version) {
          if (tool.minVersion) {
            if (semver.gte(result.version, tool.minVersion)) {
              result.meetsVersionRequirement = true;
              result.message = `Version ${result.version} satisfies >=${tool.minVersion}.`;
              logger.write(`${CHECK_MARK} (v${result.version})\n`);
            } else {
              result.meetsVersionRequirement = false;
              result.message = `Version ${result.version} is older than required >=${tool.minVersion}.`;
              logger.write(`${CROSS_MARK} (v${result.version} - required: >=${tool.minVersion})\n`);
              console.log(`    ${red(result.message)}`);
              if (tool.installationHint) {
                console.log(`    ${yellow("Hint:")} ${tool.installationHint}`);
              }
            }
          } else {
            // No minimum version specified, just existence is enough
            result.meetsVersionRequirement = true;
            result.message = `Found version ${result.version}. No minimum version specified.`;
            logger.write(`${CHECK_MARK} (v${result.version} - existence check only)\n`);
          }
        } else {
          // Regex matched but couldn't clean version (should be rare with semver.clean)
          result.meetsVersionRequirement = false;
          result.message = `Could not parse a valid version string from output: "${output}". Regex: ${tool.versionParseRegex}`;
          logger.write(`${CROSS_MARK}\n`);
          console.log(`    ${red(result.message)}`);
        }
      } else {
        result.meetsVersionRequirement = false;
        result.message = `Could not parse version from output: "${output}". Regex: ${tool.versionParseRegex}`;
        logger.write(`${CROSS_MARK}\n`);
        console.log(`    ${red(result.message)}`);
      }
    }

    results.push(result);
    if (!result.meetsVersionRequirement && !result.isOptional) {
      overallSuccess = false;
    }
  }

  console.log(blue(bold("\n🩺 Doctor Summary:")));
  if (overallSuccess) {
    console.log(green(bold("  All critical checks passed! Your environment looks good. ✅")));
  } else {
    console.log(red(bold("  Some checks failed. Please review the messages above. ❌")));
    const failedChecks = results.filter((r) => !r.meetsVersionRequirement && !r.isOptional);
    if (failedChecks.length > 0) {
      console.log(yellow("\n  Required tools with issues:"));
      failedChecks.forEach((r) => {
        console.log(`    - ${cyan(r.displayName)}: ${red(r.message.split(".")[0])}`);
        if (r.installationHint) {
          console.log(`      ${gray("Hint: " + r.installationHint)}`);
        }
      });
    }
  }
  const optionalFailures = results.filter((r) => !r.meetsVersionRequirement && r.isOptional);
  if (optionalFailures.length > 0) {
    console.log(yellow("\n  Optional tools with issues:"));
    optionalFailures.forEach((r) => {
      console.log(`    - ${cyan(r.displayName)}: ${yellow(r.message.split(".")[0])}`);
      if (r.installationHint) {
        console.log(`      ${gray("Hint: " + r.installationHint)}`);
      }
    });
  }

  return {
    overallSuccess,
    results,
  };
}
