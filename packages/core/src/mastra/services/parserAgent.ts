import {Agent} from "@mastra/core/agent";
import {thinkModel} from "../llm/index.js";
export const logParserAgent = new Agent({
  name: "LogParserAgent",
  instructions: `You are a highly-structured data parser.

Your task is to receive a Markdown file content with YAML front matter and convert it into a valid JSON object that strictly adheres to the provided Zod schema.
You must extract the front matter fields AND parse the 'Roadmap' and 'Work Log' sections from the markdown body.
The 'Roadmap' is a nested Markdown checklist.

Your output MUST be ONLY the JSON object, without any surrounding text or markdown backticks.`,
  model: thinkModel,
});
