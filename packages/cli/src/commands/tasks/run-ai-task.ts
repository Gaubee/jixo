import {blue, cyan, FileEntry, gray, green, red, spinner, YAML, yellow, type Spinner} from "@gaubee/nodekit";
import {func_catch} from "@gaubee/util";
import {AISDKError, streamText, type AssistantModelMessage, type ModelMessage, type ToolCallPart, type ToolSet} from "ai";
import createDebug from "debug";
import ms from "ms";
import os from "node:os";
import {match, P} from "ts-pattern";
import {safeEnv} from "../../env.js";
import {handleError} from "../../helper/handle-ai-error.js";
import {getAllPromptConfigs, getAllSkillMap as getAllSkillNavMap} from "../../helper/prompts-loader.js";
import type {AiTask} from "../../helper/resolve-ai-tasks.js";
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
  const availableTools: ToolSet = {
    ...(await tools.fileSystem(ai_task.cwd)),
    // ...(await tools.memory(path.join(ai_task.cwd, `.jixo/${ai_task.name}.memory.json`))),
    ...(await tools.pnpm()),
    ...(await tools.jixo(ai_task)),
    ...(await tools.git(ai_task.cwd)),
  };

  const loading = spinner(`Initializing AI task: ${cyan(ai_task.name)}...`);

  loading.prefixText = "⏳ ";
  loading.start();
  const endInfo = {
    prefixText: "",
    text: "",
    get suffixText() {
      return `⏱️  ${gray(ms(new Date().getTime() - new Date(ai_task.startTime).getTime(), {long: true}))}`;
    },
  };
  let prefixText = loading.prefixText;
  const updatePrefixText = () => {
    loading.prefixText = `${green(`[${loopTimes}]`)} ${cyan(`+${ms(Date.now() - new Date(ai_task.startTime).getTime())}`)}\n${prefixText}`;
  };
  const ti = setInterval(updatePrefixText, 1000);
  updatePrefixText();
  try {
    await _runAiTask(
      ai_task,
      availableTools,
      allFiles,
      changedFilesSet,
      {
        get text() {
          return loading.text;
        },
        set text(v) {
          loading.text = v;
        },
        get prefixText() {
          return prefixText;
        },
        set prefixText(v) {
          prefixText = v;
          updatePrefixText();
        },
      },
      endInfo,
    );
  } finally {
    // Fallback spinner stop if loop exits unexpectedly
    clearInterval(ti);
    loading.stopAndPersist(endInfo);
  }
};

const _runAiTask = async (
  ai_task: AiTask,
  availableTools: ToolSet,
  allFiles: FileEntry[],
  changedFilesSet: Record<string, FileEntry[]>,
  loading: Pick<Spinner, "prefixText" | "text">,
  endInfo: {
    prefixText: string;
    text: string;
    readonly suffixText: string;
  },
) => {
  const model = getModel(ai_task.model);

  const initialMessages: ModelMessage[] = [];
  const maxTurns = 40; // Safeguard against infinite loops

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
      .replaceAll("{{maxTurns}}", () => `${maxTurns}`)
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

  loop: for (let turn = 0; turn < maxTurns; turn++) {
    if (turn === 0) {
      loading.text = `Connecting To ${model.provider}...`;
    } else {
      loading.text = `Processing turn ${turn + 1}...`;
      currentMessages.push({
        role: "user",
        content: `Turns: ${turn}/${maxTurns}`,
      });
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
      if (firstStreamPart) {
        firstStreamPart = false;
        loading.text = ""; // Clear initial connecting/processing message
      }

      const LOOP_SIGNAL = await match(part)
        .with({type: "text"}, (textPart) => {
          loading.prefixText = "🤖 ";
          let assistantTextPart = assistantMessageContent.findLast((part) => part.type === "text");
          if (assistantTextPart == null) {
            assistantTextPart = {type: "text", text: ""};
            assistantMessageContent.push(assistantTextPart);
          }
          assistantTextPart.text += textPart.text;
          if (fullText === "") loading.text = "";
          fullText += textPart.text;
          loading.text = "\n" + fullText.split("\n").slice(-10).join("\n");
        })
        .with({type: "tool-call"}, (callPart) => {
          loading.prefixText = "🛠️ ";
          loading.text = "Requesting tool: " + blue(callPart.toolName);
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
          loading.prefixText = endInfo.prefixText = "❌ ";
          loading.text = endInfo.text = red(`${errorPart.error}`);
          const _handled = await handleError(errorPart.error, loading);

          return LOOP_SIGNALS.BREAK; // Stop processing on error
        })
        .with({type: "reasoning"}, (reasoningPart) => {
          loading.prefixText = "🤔 ";
          if (fullReasoningText === "") loading.text = "";
          fullReasoningText += reasoningPart.text;
          loading.text = "\n" + gray(fullReasoningText.split("\n").slice(-3).join("\n"));
        })
        // Add other console logs for debugging if needed, but keep them minimal for production
        .with({type: "file"}, (p) => {
          loading.prefixText = "📃 ";
          loading.text = p.file.mediaType;

          log("\nQAQ file: %y", p.file);
        })
        .with({type: "source"}, (p) => {
          loading.prefixText = "🔗 ";
          if (p.sourceType === "url") {
            if (p.title) {
              loading.text = `[${p.title}](${p.url})`;
            } else {
              loading.text = p.url;
            }
          } else {
            if (p.filename) {
              loading.text = `[${p.title}](${p.filename})`;
            } else {
              loading.text = p.title;
            }
          }

          log("\nQAQ source: %y", p);
        })
        .with({type: "tool-result"}, (p) => log("\nQAQ tool-result: %y", p))
        .with({type: "tool-call-streaming-start"}, (p) => log("\nQAQ tool-call-streaming-start: %y", p))
        .with({type: "tool-call-delta"}, (p) => log("\nQAQ tool-call-delta: %y", p))
        .with({type: "reasoning-part-finish"}, (p) => log("\nQAQ reasoning-part-finish: %y", p))
        .with({type: "start-step"}, (p) => log("\nQAQ start-step: %y", p))
        .with({type: "finish-step"}, (p) => log("\nQAQ finish-step: %y", p))
        .with({type: "start"}, (p) => log("\nQAQ start: %y", p))
        .with({type: "finish"}, async (finishPart) => {
          log("\nQAQ finish: %y", finishPart);
          // Add the assistant's message from this turn to the history
          currentMessages.push(_currentAssistantMessage);

          if (finishPart.finishReason === "stop" || finishPart.finishReason === "length") {
            loading.prefixText = endInfo.prefixText = "✅ ";
            loading.text = endInfo.text = green(`${cyan(`[${ai_task.name}]`)} Completed`);
            // Task finished without tool calls or after tool calls that didn't lead to more calls.
            return LOOP_SIGNALS.RETURN; // Exit the outer loop and function
          }

          if (finishPart.finishReason === "tool-calls") {
            if (requestedToolCalls.length === 0) {
              loading.prefixText = endInfo.prefixText = "🚧 ";
              loading.text = endInfo.text = yellow(`${cyan(`[${ai_task.name}]`)} finished with 'tool-calls' but no tools were requested.`);
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
              loading.text = `Executing tool: ${toolCall.toolName}...`;
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
                loading.text = `Tool ${toolCall.toolName} executed.`;
              } else {
                loading.text = `Error executing tool ${toolCall.toolName}.`;
              }
            }
            currentMessages.push(...toolResultMessages);
            // Loop continues for the next turn
          } else {
            // Other finish reasons, potentially an error or unexpected state
            loading.prefixText = endInfo.prefixText = "🛑 ";
            loading.text = endInfo.text = red(`${cyan(`[${ai_task.name}]`)} task finished with unhandled reason: ${finishPart.finishReason}`);
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
    if (turn === maxTurns - 1) {
      loading.prefixText = endInfo.prefixText = "🚧 ";
      loading.text = endInfo.text = yellow(`${cyan(`[${ai_task.name}]`)} Max interaction turns reached.`);
      break;
    }
  }
};
