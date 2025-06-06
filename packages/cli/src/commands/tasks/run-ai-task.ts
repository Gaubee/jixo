import {cyan, FileEntry, gray, green, spinner, YAML} from "@gaubee/nodekit";
import {func_catch} from "@gaubee/util";
import {streamText, type AssistantModelMessage, type ModelMessage, type ToolCallPart} from "ai";
import {match, P} from "ts-pattern";
import {safeEnv} from "../../env.js";
import {getModelMessage, getPromptConfigs} from "../../helper/prompts-loader.js";
import type {AiTask} from "../../helper/resolve-ai-tasks.js";
import {tools} from "./ai-tools.js";
import {providers} from "./model-providers.js";

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
        return providers.deepseek("deepseek-chat");
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

export const runAiTask = async (ai_task: AiTask, allFiles: FileEntry[], changedFiles: FileEntry[]) => {
  const model = getModel(ai_task.model);
  const availableTools = {
    ...(await tools.fileSystem(ai_task.cwd)),
    // ...(await tools.fetch()),
    // ...(await tools.git(ai_task.cwd)),
  };

  const initialMessages: ModelMessage[] = getModelMessage(ai_task.agents);
  initialMessages.push({
    role: "user",
    content: getPromptConfigs()
      .user.content //
      .replace(/\{\{task.(\w+)\}\}/, (key) => Reflect.get(ai_task, key))
      .replace(/\{\{env.(\w+)\}\}/, (key) => Reflect.get(process.env, key) ?? "")
      .replaceAll(
        "{{allFiles}}",
        [
          //
          `# files dir: ${ai_task.dir}`,
          `# files count: ${allFiles.length}`,
          YAML.stringify(allFiles.map((e) => e.relativePath)),
        ].join("\n"),
      )
      .replaceAll(
        "{{changedFiles}}",
        [
          //
          `# files dir: ${ai_task.dir}`,
          `# files count: ${allFiles.length}`,
          YAML.stringify(changedFiles.map((e) => e.relativePath)),
        ].join("\n"),
      ),
  });

  let currentMessages: ModelMessage[] = [...initialMessages];
  const maxTurns = 10; // Safeguard against infinite loops
  const loading = spinner("Initializing AI task...");
  loading.prefixText = "⏳ ";
  loading.start();

  for (let turn = 0; turn < maxTurns; turn++) {
    loading.text = turn === 0 ? `Connecting To ${model.provider}...` : `Processing turn ${turn + 1}...`;

    const result = await streamText({
      model: model,
      messages: currentMessages,
      tools: availableTools,
      toolChoice: "auto", // Changed to auto for more flexibility
    });

    let reasoning = "";
    let fulltext = "";
    let firstStreamPart = true;
    const requestedToolCalls: ToolCallPart[] = []; // Using any for now, should be ToolCallPart from 'ai'

    let assistantMessageContent = "";
    let currentAssistantMessage: AssistantModelMessage = {role: "assistant", content: ""};

    const LOOP_SIGNALS = {
      RETURN: "RETURN",
      BREAK: "BREAK",
      CONTINUE: "CONTINUE",
    } as const;
    for await (const part of result.fullStream) {
      if (firstStreamPart) {
        firstStreamPart = false;
        loading.text = ""; // Clear initial connecting/processing message
      }
      const LOOP_SIGNAL = await match(part)
        .with({type: "text"}, (textPart) => {
          loading.prefixText = "🤖 ";
          assistantMessageContent += textPart.text;
          currentAssistantMessage.content = assistantMessageContent;
          if (fulltext === "") fulltext = "\n"; // For consistent display
          fulltext += textPart.text;
          loading.text = fulltext;
        })
        .with({type: "tool-call"}, (callPart) => {
          loading.prefixText = "🛠️ ";
          console.log("\nQAQ tool-call", callPart);
          requestedToolCalls.push(callPart);
          // Update assistant message to include tool calls
          currentAssistantMessage.content = [
            {
              type: "tool-call",
              toolCallId: callPart.toolCallId,
              toolName: callPart.toolName,
              args: callPart.args,
            },
          ];
          loading.text = `Requesting tool: ${callPart.toolName}`;
        })
        .with({type: "error"}, (errorPart) => {
          loading.prefixText = "❌ ";
          console.error("\nQAQ error", errorPart.error);
          loading.fail(`Error: ${errorPart.error?.toString()}`);
          return LOOP_SIGNALS.BREAK; // Stop processing on error
        })
        .with({type: "reasoning"}, (reasoningPart) => {
          loading.prefixText = "🤔 ";
          if (reasoning === "") loading.text = "";
          reasoning += reasoningPart.text;
          loading.text = gray(reasoning.split("\n").slice(-3).join("\n"));
        })
        // Add other console logs for debugging if needed, but keep them minimal for production
        .with({type: "file"}, (p) => console.log("\nQAQ file", p.file))
        .with({type: "source"}, (p) => console.log("\nQAQ source", p))
        .with({type: "tool-result"}, (p) => console.log("\nQAQ tool-result", p))
        .with({type: "tool-call-streaming-start"}, (p) => console.log("\nQAQ tool-call-streaming-start", p))
        .with({type: "tool-call-delta"}, (p) => console.log("\nQAQ tool-call-delta", p))
        .with({type: "reasoning-part-finish"}, (p) => console.log("\nQAQ reasoning-part-finish", p))
        .with({type: "start-step"}, (p) => console.log("\nQAQ start-step", p))
        .with({type: "finish-step"}, (p) => console.log("\nQAQ finish-step", p))
        .with({type: "start"}, (p) => console.log("\nQAQ start", p))
        .with({type: "finish"}, async (finishPart) => {
          console.log("\nQAQ finish", finishPart);
          // Add the assistant's message from this turn to the history
          currentMessages.push(currentAssistantMessage);

          if (finishPart.finishReason === "stop" || finishPart.finishReason === "length") {
            loading.prefixText = "✅ ";
            loading.text = green(`${cyan(`[${ai_task.name}]`)} Completed`);
            // Task finished without tool calls or after tool calls that didn't lead to more calls.
            return LOOP_SIGNALS.RETURN; // Exit the outer loop and function
          }

          if (finishPart.finishReason === "tool-calls") {
            if (requestedToolCalls.length === 0) {
              loading.warn("Finished with 'tool-calls' but no tools were requested.");
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
            loading.warn(`Task finished with unhandled reason: ${finishPart.finishReason}`);
            return LOOP_SIGNALS.RETURN;
          }
        })
        .otherwise(() => {}); // Handle any other part types if necessary

      if (LOOP_SIGNAL === LOOP_SIGNALS.RETURN) {
        break;
      } else if (LOOP_SIGNAL === LOOP_SIGNALS.BREAK) {
        break;
      }
    }
    // If the stream finishes without a 'finish' part (e.g. error thrown inside), this loop might exit. Ensure spinner stops.
    if (turn === maxTurns - 1) {
      loading.warn("Max interaction turns reached.");
      return;
    }
  }
  // Fallback spinner stop if loop exits unexpectedly
  loading.stop();
};
