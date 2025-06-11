import {blue, cyan, FileEntry, gray, green, red, spinner, YAML, yellow} from "@gaubee/nodekit";
import {func_catch} from "@gaubee/util";
import {AISDKError, streamText, type AssistantModelMessage, type ModelMessage, type ToolCallPart, type ToolSet} from "ai";
import createDebug from "debug";
import ms from "ms";
import {open} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {match, P} from "ts-pattern";
import {safeEnv} from "../../env.js";
import {handleError} from "../../helper/handle-ai-error.js";
import {getAllPromptConfigs, getAllSkillMap as getAllSkillNavMap} from "../../helper/prompts-loader.js";
import type {AiTask} from "../../helper/resolve-ai-tasks.js";
import {AiTaskTui} from "./ai-tasl-tui.js";
import {tools} from "./ai-tools.js";
import {providers} from "./model-providers.js";

createDebug.formatters.y = (v) => {
  return JSON.stringify(v, (_k, v) => {
    if (typeof v === "string") {
      let slice_len = 0;
      if (v.length > 200) {
        slice_len = 50;
      }
      if (v.length > 100) {
        slice_len = 30;
      }
      if (slice_len > 0) {
        return `<string:${v.length}>${v.slice(0, slice_len)}${gray("...")}${v.slice(-slice_len)}`;
      }
      return v;
    }
    if (AISDKError.isInstance(v)) {
      return red(v.message);
    }
    return v;
  });
};
const log = createDebug("jixo:run-ai-task");

const getModel = (model?: string) => {
  return match(model)
    .with(P.string.startsWith("deepseek-"), (model) => providers.deepseek(model))
    .with(P.string.startsWith("gemini-"), (model) => providers.google(model))
    .with(P.string.startsWith("o3-"), P.string.startsWith("o1-"), P.string.startsWith("gpt-"), (model) => providers.openai(model))
    .with(P.string.startsWith("claude-"), (model) => providers.anthropic(model))
    .with(P.string.startsWith("grok-"), (model) => providers.xai(model))
    .with(P.string.includes("/"), (model) => providers.deepinfra(model))
    .otherwise(() => {
      if (safeEnv.JIXO_DEEPSEEK_API_KEY) {
        return providers.deepseek("deepseek-reasoner");
      }
      if (safeEnv.JIXO_GOOGLE_API_KEY) {
        return providers.google("gemini-2.5-pro-preview-05-06");
      }
      if (safeEnv.JIXO_OPENAI_API_KEY) {
        return providers.openai("o3-mini");
      }
      if (safeEnv.JIXO_ANTHROPIC_API_KEY) {
        return providers.anthropic("claude-4-sonnet-20250514");
      }
      if (safeEnv.JIXO_XAI_API_KEY) {
        return providers.xai("grok-3-beta");
      }
      if (safeEnv.JIXO_DEEPINFRA_API_KEY) {
        return providers.deepinfra("meta-llama/Meta-Llama-3.1-405B-Instruct");
      }
      return providers.deepseek("deepseek-reasoner");
    });
};
export const runAiTask = async (ai_task: AiTask, loopTimes: number, allFiles: FileEntry[], changedFilesSet: Record<string, FileEntry[]>) => {
  const tool_spinner = spinner({
    prefixText: "🧰",
    text: "正在准备环境工具...",
  });
  tool_spinner.start();
  const availableTools: ToolSet = {
    ...(await tools.fileSystem(ai_task.cwd)),
    // ...(await tools.memory(path.join(ai_task.cwd, `.jixo/${ai_task.name}.memory.json`))),
    ...(await tools.pnpm()),
    ...(await tools.jixo(ai_task)),
    ...(await tools.git(ai_task.cwd)),
  };
  tool_spinner.clear();
  tool_spinner.stop();

  const json_line_log_file_handle = await open(path.join(ai_task.cwd, ".jixo", `${ai_task.executor}.${loopTimes.toString().padStart(2, "0")}.log.jsonl`), "a");
  const __writeJsonLineLog = (...lineDatas: any[]) => {
    for (const lineData of lineDatas) {
      try {
        json_line_log_file_handle.appendFile(JSON.stringify(lineData) + "\n");
      } catch {}
    }
  };

  const tui = new AiTaskTui(ai_task, spinner({text: `Initializing AI task: ${cyan(ai_task.name)}...`, prefixText: "⏳ "}));
  tui.spinner.start();
  const updateTuiState = () => {
    tui.setStatus("loop and time", `${green(`[${loopTimes}]`)} ${cyan(`+${ms(Date.now() - new Date(ai_task.startTime).getTime())}`)}`);
  };
  const ti = setInterval(updateTuiState, 1000);
  updateTuiState();
  try {
    await _runAiTask(ai_task, availableTools, allFiles, changedFilesSet, tui, __writeJsonLineLog);
  } finally {
    // Fallback spinner stop if loop exits unexpectedly
    clearInterval(ti);
    tui.stop();
    json_line_log_file_handle.close();
  }
};

const _runAiTask = async (
  ai_task: AiTask,
  availableTools: ToolSet,
  allFiles: FileEntry[],
  changedFilesSet: Record<string, FileEntry[]>,
  tui: AiTaskTui,
  __writeJsonLineLog: (...lineDatas: any[]) => void,
) => {
  const model = getModel(ai_task.model);

  const initialMessages: ModelMessage[] = [];
  const maxSteps = 40; // Safeguard against infinite loops

  const promptConfigs = getAllPromptConfigs();

  for (const role of ["system", "user"] as const) {
    const promptConfig = promptConfigs[role];

    const promptContent = promptConfig.content //
      .replace(/\{\{task.([\.\w]+)\}\}/g, (_, key) => {
        if (key.includes(".")) {
          const paths = key.split(".");
          let res: any = ai_task;
          for (const p of paths) {
            res = Reflect.get(res, p);
            if (!res) {
              break;
            }
          }
          return res;
        } else {
          return Reflect.get(ai_task, key);
        }
      })
      .replace(/\{\{env.(\w+)\}\}/g, (_, key) => {
        const envKey = key.toUpperCase();
        const envValue =
          Reflect.get(process.env, envKey) ??
          match(envKey)
            .with("USER", () => os.userInfo().username)
            .otherwise(() => "");
        return envValue;
      })
      .replaceAll("{{allSkills}}", (_, key) => {
        return YAML.stringify(getAllSkillNavMap());
      })
      .replaceAll(
        "{{allFiles}}",
        YAML.stringify({
          [ai_task.cwd]: {
            count: allFiles.length,
            file: allFiles.map((e) => e.relativePath),
          },
        }),
      )
      .replaceAll("{{maxSteps}}", () => `${maxSteps}`)
      .replaceAll(
        "{{changedFiles}}",
        YAML.stringify(
          Object.entries(changedFilesSet).reduce(
            (tree, [dir, changedFiles]) => {
              tree[dir] = {
                count: changedFiles.length,
                files: changedFiles.map((e) => e.relativePath),
              };
              return tree;
            },
            {} as Record<string, {count: number; files: string[]}>,
          ),
        ),
      );
    log(`PROMPT ${role}:`, promptContent);
    initialMessages.push({
      role: role,
      content: promptContent,
    });
  }

  const currentMessages: ModelMessage[] = [...initialMessages];

  __writeJsonLineLog(...currentMessages);

  loop: for (let step = 0; step < maxSteps; step++) {
    if (step === 0) {
      tui.setStatus("turns", `Connecting To ${model.provider}...`);
    } else {
      tui.setStatus("turns", `Processing step ${step + 1}/${maxSteps}...`);
      const userStepMessage: ModelMessage = {
        role: "user",
        content: `Steps: ${step}/${maxSteps}`,
      };
      currentMessages.push(userStepMessage);
      __writeJsonLineLog(userStepMessage);
    }
    const result = await streamText({
      model: model,
      messages: currentMessages,
      tools: availableTools,
      toolChoice: "auto", // Changed to auto for more flexibility
      onError: () => {},
    });

    let fullReasoningText = "";
    let fullText = "";
    let firstStreamPart = true;
    const requestedToolCalls: ToolCallPart[] = []; // Using any for now, should be ToolCallPart from 'ai'

    const assistantMessageContent: AssistantModelMessage["content"] & unknown[] = [];
    const _currentAssistantMessage: AssistantModelMessage = {role: "assistant", content: assistantMessageContent};

    const LOOP_SIGNALS = {
      RETURN: "RETURN",
      BREAK: "BREAK",
      CONTINUE: "CONTINUE",
      ERROR: "ERROR",
    } as const;
    for await (const part of result.fullStream) {
      __writeJsonLineLog(part);

      if (firstStreamPart) {
        firstStreamPart = false;
        tui.text = ""; // Clear initial connecting/processing message
      }

      const LOOP_SIGNAL = await match(part)
        .with({type: "text"}, (textPart) => {
          tui.prefixText = "🤖 ";
          let assistantTextPart = assistantMessageContent.findLast((part) => part.type === "text");
          if (assistantTextPart == null) {
            assistantTextPart = {type: "text", text: ""};
            assistantMessageContent.push(assistantTextPart);
          }
          assistantTextPart.text += textPart.text;
          if (fullText === "") tui.text = "";
          fullText += textPart.text;
          tui.text = "\n" + fullText.split("\n").slice(-10).join("\n");
        })
        .with({type: "tool-call"}, (callPart) => {
          tui.prefixText = "🛠️ ";
          tui.text = "Requesting tool: " + blue(callPart.toolName);
          log("\nQAQ tool-call: %y", callPart);
          requestedToolCalls.push(callPart);
          // Update assistant message to include tool calls
          assistantMessageContent.push({
            type: "tool-call",
            toolCallId: callPart.toolCallId,
            toolName: callPart.toolName,
            args: callPart.args,
          });
        })
        .with({type: "error"}, async (errorPart) => {
          tui.prefixText = tui.endInfo.prefixText = "❌ ";
          tui.text = tui.endInfo.text = red(`${errorPart.error}`);
          const handled = await handleError(errorPart.error, tui);
          if (!handled) {
            return LOOP_SIGNALS.BREAK; // Stop processing on error
          }
        })
        .with({type: "reasoning"}, (reasoningPart) => {
          tui.prefixText = "🤔 ";
          if (fullReasoningText === "") tui.text = "";
          fullReasoningText += reasoningPart.text;
          tui.text = "\n" + gray(fullReasoningText.split("\n").slice(-3).join("\n"));
        })
        // Add other console logs for debugging if needed, but keep them minimal for production
        .with({type: "file"}, (p) => {
          tui.prefixText = "📃 ";
          tui.text = p.file.mediaType;

          log("\nQAQ file: %y", p.file);
        })
        .with({type: "source"}, (p) => {
          tui.prefixText = "🔗 ";
          if (p.sourceType === "url") {
            if (p.title) {
              tui.text = `[${p.title}](${p.url})`;
            } else {
              tui.text = p.url;
            }
          } else {
            if (p.filename) {
              tui.text = `[${p.title}](${p.filename})`;
            } else {
              tui.text = p.title;
            }
          }

          log("\nQAQ source: %y", p);
        })
        .with({type: "tool-result"}, (p) => log("\nQAQ tool-result: %y", p))
        .with({type: "tool-call-streaming-start"}, (p) => log("\nQAQ tool-call-streaming-start: %y", p))
        .with({type: "tool-call-delta"}, (p) => log("\nQAQ tool-call-delta: %y", p))
        .with({type: "reasoning-part-finish"}, (p) => log("\nQAQ reasoning-part-finish: %y", p))
        .with({type: "start-step"}, (p) => log("\nQAQ start-step: %y", p))
        // --- START: MODIFIED SECTION ---
        .with({type: "finish-step"}, (p) => {
          log("\nQAQ finish-step: %y", p);
          /**
           * This event marks the end of an intermediate step, not the entire turn.
           * We handle potential issues here, but the main logic for continuing or
           * stopping the loop is in the final 'finish' event handler.
           */
          return match(p)
            .with({finishReason: P.union("content-filter", "error")}, (part) => {
              // A step finishing due to an error or content filter is a serious issue.
              // Update the TUI to reflect this problem immediately.
              const reasonText = part.finishReason === "content-filter" ? "Content filter violation" : "Model error";
              tui.prefixText = tui.endInfo.prefixText = "⚠️ ";
              tui.text = tui.endInfo.text = red(`Step failed due to ${reasonText}. Will be retry.`);
              log(red(`Step finished with critical reason: ${part.finishReason}`));
              return LOOP_SIGNALS.RETURN;
            })
            .with({finishReason: P.union("other", "unknown")}, (part) => {
              // Log unusual finish reasons for debugging purposes.
              log(yellow(`Step finished with an unusual reason: ${part.finishReason}`));
            })
            .otherwise(() => {
              // This covers 'stop', 'length', and 'tool-calls'. These are normal
              // reasons for a step to finish. The final 'finish' event will
              // determine the overall outcome of the turn. No special action is needed here.
              log(`Step finished with normal reason: ${p.finishReason}. Awaiting end of turn.`);
            });
        })
        // --- END: MODIFIED SECTION ---
        .with({type: "start"}, (p) => log("\nQAQ start: %y", p))
        .with({type: "finish"}, async (finishPart) => {
          log("\nQAQ finish: %y", finishPart);
          // Add the assistant's message from this step to the history
          currentMessages.push(_currentAssistantMessage);
          __writeJsonLineLog(_currentAssistantMessage);

          if (finishPart.finishReason === "stop" || finishPart.finishReason === "length") {
            tui.prefixText = tui.endInfo.prefixText = "✅ ";
            tui.text = tui.endInfo.text = green(`${cyan(`[${ai_task.name}]`)} Completed`);
            // Task finished without tool calls or after tool calls that didn't lead to more calls.
            return LOOP_SIGNALS.RETURN; // Exit the outer loop and function
          }

          if (finishPart.finishReason === "tool-calls") {
            if (requestedToolCalls.length === 0) {
              tui.prefixText = tui.endInfo.prefixText = "🚧 ";
              tui.text = tui.endInfo.text = yellow(`${cyan(`[${ai_task.name}]`)} finished with 'tool-calls' but no tools were requested.`);
              return LOOP_SIGNALS.RETURN; // Exit, something is off
            }

            const toolResultMessages: ModelMessage[] = [];
            for (const toolCall of requestedToolCalls) {
              const toolToExecute = availableTools[toolCall.toolName];
              if (!toolToExecute || typeof toolToExecute.execute !== "function") {
                console.error(`Tool ${toolCall.toolName} not found or not executable.`);
                toolResultMessages.push({
                  role: "tool",
                  content: [
                    {
                      type: "tool-result",
                      toolCallId: toolCall.toolCallId,
                      toolName: toolCall.toolName,
                      result: JSON.stringify({error: `Tool ${toolCall.toolName} not found or not executable.`}),
                      isError: true,
                    },
                  ],
                });
                continue;
              }
              tui.text = `Executing tool: ${toolCall.toolName}...`;
              const executionResult = await func_catch(() =>
                toolToExecute.execute!(toolCall.args, {
                  toolCallId: toolCall.toolCallId,
                  messages: currentMessages,
                }),
              )();
              toolResultMessages.push({
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    isError: !executionResult.success,
                    result: JSON.stringify(executionResult.success ? executionResult.result : executionResult.error),
                  },
                ],
              });
              if (executionResult.success) {
                tui.text = `Tool ${toolCall.toolName} executed.`;
              } else {
                tui.text = `Error executing tool ${toolCall.toolName}.`;
              }
            }
            currentMessages.push(...toolResultMessages);
            __writeJsonLineLog(...toolResultMessages);
            // Loop continues for the next step
          } else {
            // Other finish reasons, potentially an error or unexpected state
            tui.prefixText = tui.endInfo.prefixText = "🛑 ";
            tui.text = tui.endInfo.text = red(`${cyan(`[${ai_task.name}]`)} task finished with unhandled reason: ${finishPart.finishReason}`);
            return LOOP_SIGNALS.ERROR;
          }
        })
        .otherwise(() => {}); // Handle any other part types if necessary

      if (LOOP_SIGNAL === LOOP_SIGNALS.ERROR) {
        throw LOOP_SIGNAL;
      }
      if (LOOP_SIGNAL === LOOP_SIGNALS.RETURN) {
        break loop;
      } else if (LOOP_SIGNAL === LOOP_SIGNALS.BREAK) {
        break;
      }
    }
    // If the stream finishes without a 'finish' part (e.g. error thrown inside), this loop might exit. Ensure spinner stops.
    if (step === maxSteps - 1) {
      tui.prefixText = tui.endInfo.prefixText = "🚧 ";
      tui.text = tui.endInfo.text = yellow(`${cyan(`[${ai_task.name}]`)} Max interaction steps reached.`);
      break;
    }
  }
};
