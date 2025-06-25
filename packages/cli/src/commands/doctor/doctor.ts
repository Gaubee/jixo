import {blue, cyan, green, red, spinner, yellow} from "@gaubee/nodekit";
import {execSync} from "node:child_process";
import semver from "semver";
import {iter_map_not_null} from "@gaubee/util";
import type {DoctorConfig, DoctorReport, ToolCheckResult} from "./types.js";
import {safeEnv} from "../../env.js";

const CHECK_MARK = green("✔");
const CROSS_MARK = red("✖");
const WARN_MARK = yellow("⚠");

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

async function checkServiceHealth(id: string, displayName: string, hint?: string): Promise<ToolCheckResult> {
  const result: ToolCheckResult = {
    id,
    displayName,
    exists: false,
    meetsVersionRequirement: false,
    isOptional: false,
    message: "",
    installationHint: hint,
  };

  const url = `${safeEnv.JIXO_CORE_URL}/jixo/v1/health`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      result.exists = true;
      result.meetsVersionRequirement = true;
      result.message = `Service is running and healthy at ${url}`;
    } else {
      result.message = `Service responded with status ${response.status} at ${url}`;
    }
  } catch (e) {
    result.message = `Could not connect to service at ${url}. Is it running?`;
  }
  return result;
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

    let result: ToolCheckResult;

    if (!tool.versionCommand) { // Custom check logic for services
        result = await checkServiceHealth(tool.id, tool.displayName, tool.installationHint);
        if (result.exists) {
            tool_log = [`${SUCCESS_MARK()} ${TOOL_LOG_TITLE}`, `  ${green(result.message)}`];
        } else {
            tool_log = [`${FAIL_MARK()} ${TOOL_LOG_TITLE}`, `  ${red(result.message)}`, tool.installationHint && `  ${yellow("Hint:")} ${tool.installationHint}`];
        }
    } else { // Original command-based check logic
        result = {
          id: tool.id,
          displayName: tool.displayName,
          exists: false,
          meetsVersionRequirement: false,
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
            `${FAIL_MARK()} ${TOOL_LOG_TITLE}`,
            `  ${red(result.message)}`,
            tool.installationHint && `  ${yellow("Hint:")} ${tool.installationHint}`,
          ];
        } else {
          result.exists = true;
          const output = execResult.stdout.trim();
          const match = output.match(tool.versionParseRegex!);

          if (match && match[1]) {
            result.version = semver.clean(match[1]) || undefined;
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
                  if (tool.installationHint) {
                    tool_log.push(`  ${yellow("Hint:")} ${tool.installationHint}`);
                  }
                }
              } else {
                result.meetsVersionRequirement = true;
                result.message = `Found version ${result.version}. No minimum version specified.`;
                tool_log.push(`${SUCCESS_MARK()} ${TOOL_LOG_TITLE} (v${result.version} - existence check only)`);
              }
            } else {
              result.meetsVersionRequirement = false;
              result.message = `Could not parse a valid version string from output: "${output}".`;
              tool_log.push(`${FAIL_MARK()} ${TOOL_LOG_TITLE}`);
              tool_log.push(`  ${red(result.message)}`);
            }
          } else {
            result.meetsVersionRequirement = false;
            result.message = `Could not parse version from output: "${output}".`;
            tool_log.push(`${FAIL_MARK()} ${TOOL_LOG_TITLE}`);
            tool_log.push(`  ${red(result.message)}`);
          }
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
