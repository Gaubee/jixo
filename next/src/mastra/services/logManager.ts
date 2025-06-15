import {Agent} from "@mastra/core";
import {createHash} from "node:crypto";
import _fs from "node:fs";
import path from "node:path";
import {zodToJsonSchema} from "zod-to-json-schema";
import {type LogFileData, LogFileSchema} from "../entities.js";
import {commonModel, thinkModel} from "../llm/google.js";
const fsp = _fs.promises;

export const parserAgent = new Agent({
  name: "ParserAgent",
  instructions: `You are a highly-structured data parser. Your task is to receive a Markdown file content with YAML front matter and convert it into a valid JSON object that strictly adheres to the provided Zod schema. You must extract the front matter fields AND parse the 'Roadmap' section from the Markdown body. The 'Roadmap' is a Markdown checklist.
  
  Example Markdown Input:
  ---
  title: "My Job"
  progress: "50%"
  ---
  ## Roadmap
  - [x] 1.1 First task
    - status: Completed
    - runner: agent-123
  - [ ] 1.2 Second task
    - status: Pending
  
  Your output MUST be ONLY the JSON object, without any surrounding text or markdown backticks. The JSON must contain the 'roadmap' array.
  
  The Zod schema for the output is:
  ${JSON.stringify(zodToJsonSchema(LogFileSchema), null, 2)}`,
  model: thinkModel,
});

export const serializerAgent = new Agent({
  name: "SerializerAgent",
  instructions: `You are a data serializer. You receive a JSON object and you must convert it into a beautiful, human-readable Markdown file with YAML front matter. The JSON object adheres to a specific schema. The 'title' and 'progress' fields go into the front matter. The 'roadmap' array should be formatted as a Markdown checklist under a '## Roadmap' heading. 
  - For tasks with status 'Completed', use '- [x]'.
  - For all other statuses, use '- [ ]'.
  - The task's 'status' and 'runner' (if it exists) should be indented sub-items.
  
  Example JSON Input:
  {
    "title": "My Job",
    "progress": "50%",
    "roadmap": [
      { "id": "1.1", "description": "First task", "status": "Completed", "runner": "agent-123" },
      { "id": "1.2", "description": "Second task", "status": "Pending" }
    ],
    "workLog": []
  }
  
  Your output MUST be ONLY the Markdown file content, starting with '---'.`,
  model: commonModel,
});

// --- 日志管理器 ---
const LOG_FILE_DIR = path.join(process.cwd(), ".jixo");
const CACHE_DIR = path.join(LOG_FILE_DIR, "cache");

export const logManager = {
  _cache: new Map<string, LogFileData>(),
  _getLogFilePath: (jobName: string) => path.join(LOG_FILE_DIR, `${jobName}.log.md`),

  read: async (jobName: string): Promise<LogFileData> => {
    const filePath = logManager._getLogFilePath(jobName);
    let fileContent;
    try {
      fileContent = await fsp.readFile(filePath, "utf-8");
    } catch {
      fileContent = "---\ntitle: _待定_\nprogress: '0%'\n---\n\n## Roadmap\n\n## Work Log\n";
    }
    const hash = createHash("sha256").update(fileContent).digest("hex");
    if (logManager._cache.has(hash)) {
      console.log(`[LogManager] Cache hit for job '${jobName}'.`);
      return logManager._cache.get(hash)!;
    }
    console.log(`[LogManager] Cache miss. Invoking ParserAgent for job '${jobName}'...`);
    const result = await parserAgent.generate(fileContent, {output: LogFileSchema});
    const parsedData = result.object;
    logManager._cache.set(hash, parsedData);
    return parsedData;
  },

  update: async (jobName: string, logData: LogFileData): Promise<void> => {
    const filePath = logManager._getLogFilePath(jobName);
    console.log(`[LogManager] Invoking SerializerAgent to update log for job '${jobName}'...`);
    const validatedLogData = LogFileSchema.parse(logData);
    const result = await serializerAgent.generate(JSON.stringify(validatedLogData, null, 2));
    const newFileContent = result.text;
    await fsp.writeFile(filePath, newFileContent, "utf-8"); // 改为异步写入
    console.log(`[LogManager] Log file for job '${jobName}' updated.`);
    const hash = createHash("sha256").update(newFileContent).digest("hex");
    logManager._cache.set(hash, validatedLogData);
  },

  init: async (jobName: string, content: string) => {
    await fsp.mkdir(LOG_FILE_DIR, {recursive: true}); // 改为异步创建目录
    await fsp.writeFile(logManager._getLogFilePath(jobName), content); // 改为异步写入
  },
};
