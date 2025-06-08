// doctor.ts
import {blue, cyan, green, red, spinner, yellow} from "@gaubee/nodekit";
import {execSync} from "node:child_process";
import semver from "semver";

import {iter_map_not_null} from "@gaubee/util";
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

export async function runDoctor(config: DoctorConfig, enableLog: boolean = true): Promise<DoctorReport> {
  const LOG_TITLE = "Running Environment Doctor 🏥\n\n";
  const logger = spinner(LOG_TITLE);
  if (enableLog) {
    logger.start();
  }

  const results: ToolCheckResult[] = [];
  let overallSuccess = true;
  let overallWarn = false;

  const tool_logs: string[] = [];

  for (const [index, tool] of config.entries()) {
    const TOOL_LOG_TITLE = `${blue(`[${tool.id}]`)} ${cyan(tool.displayName)}`;
    const SUCCESS_MARK = () => CHECK_MARK;
    const FAIL_MARK = () => {
      overallWarn = true;
      return tool.optional ? WARN_MARK : CROSS_MARK;
    };
    const setToolLog = (update: (cur: string) => string | (string | undefined | null)[]) => {
      const log = update(tool_logs[index] ?? "");
      tool_logs[index] = (Array.isArray(log) ? iter_map_not_null(log, (v) => (v ? v : null)) : [log]).map((line) => "   " + line).join("\n");
      logger.text = LOG_TITLE + tool_logs.join("\n");
    };
    setToolLog(() => `Checking ${TOOL_LOG_TITLE}... `);
    let tool_log: (string | undefined | null)[] = [];

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
      tool_log = [
        //
        `${FAIL_MARK()} ${TOOL_LOG_TITLE}`,
        `  ${red(result.message)}`,
        tool.installationHint && `  ${yellow("Hint:")} ${tool.installationHint}`,
      ];
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
              tool_log.push(`${SUCCESS_MARK()} ${TOOL_LOG_TITLE} (v${result.version})`);
            } else {
              result.meetsVersionRequirement = false;
              result.message = `Version ${result.version} is older than required >=${tool.minVersion}.`;
              tool_log.push(`${FAIL_MARK()} ${TOOL_LOG_TITLE} (v${result.version} - required: >=${tool.minVersion})`);
              tool_log.push(`  ${red(result.message)}`);
              if (tool.installationHint) {
                tool_log.push(`  ${yellow("Hint:")} ${tool.installationHint}`);
              }
            }
          } else {
            // No minimum version specified, just existence is enough
            result.meetsVersionRequirement = true;
            result.message = `Found version ${result.version}. No minimum version specified.`;
            tool_log.push(`${SUCCESS_MARK()} ${TOOL_LOG_TITLE} (v${result.version} - existence check only)`);
          }
        } else {
          // Regex matched but couldn't clean version (should be rare with semver.clean)
          result.meetsVersionRequirement = false;
          result.message = `Could not parse a valid version string from output: "${output}". Regex: ${tool.versionParseRegex}`;
          tool_log.push(`${FAIL_MARK()} ${TOOL_LOG_TITLE}`);
          tool_log.push(`  ${red(result.message)}`);
        }
      } else {
        result.meetsVersionRequirement = false;
        result.message = `Could not parse version from output: "${output}". Regex: ${tool.versionParseRegex}`;
        tool_log.push(`${FAIL_MARK}`);
        tool_log.push(`  ${red(result.message)}`);
      }
    }

    setToolLog(() => tool_log);

    results.push(result);
    if (!result.meetsVersionRequirement && !result.isOptional) {
      overallSuccess = false;
    }
  }

  const LOG_SUMMERY = `${overallSuccess ? (overallWarn ? "⚠️ " : "✅") : "💊"} JIXO Environment Doctor 🏥\n\n`;
  logger.stopAndPersist({
    text: LOG_SUMMERY + tool_logs.join("\n") + "\n",
  });

  return {
    overallSuccess,
    results,
  };
}
