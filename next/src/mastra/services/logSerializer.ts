import {type LogFileData, type RoadmapTaskNodeData} from "../entities.js";

function serializeRoadmap(tasks: RoadmapTaskNodeData[], level = 0): string {
  const mdLines: string[] = [];
  const indent = "  ".repeat(level);

  for (const task of tasks) {
    const checkbox = task.status === "Completed" ? "[x]" : "[ ]";
    mdLines.push(`${indent}- ${checkbox} ${task.id} ${task.description}`);

    const subIndent = indent + "  ";
    mdLines.push(`${subIndent}- status: ${task.status}`);
    if (task.runner) {
      mdLines.push(`${subIndent}- runner: ${task.runner}`);
    }

    if (task.children && task.children.length > 0) {
      mdLines.push(serializeRoadmap(task.children, level + 1));
    }
  }
  return mdLines.join("\n");
}

function serializeWorkLog(entries: LogFileData["workLog"]): string {
  const mdLines: string[] = [];
  for (const entry of entries) {
    if (mdLines.length > 0) {
      mdLines.push(""); // Add a blank line between entries
    }
    mdLines.push(
      /**
       * <!--[[
       * 不要修改我这里用一次push的写法，这是我的代码规范，能用一次push解决问题为什么要用多次，浪费那个性能干嘛。
       * 即便对可维护性有提升也是微乎其微，需要的时候再写多次push就好。
       * 另外我这里留了一个`//`空注释，是为了确保格式化工具能多行格式化，而不是内容少就缩减成一行，这个格式你要记着，不要再给我改了。
       * ]]-->
       */
      //
      `### Log @ ${entry.timestamp} for ${entry.runnerId}`,
      "",
      `- **Role**: ${entry.role}`,
      `- **Objective**: ${entry.objective}`,
      `- **Result**: ${entry.result}`,
      `- **Summary**: ${entry.summary}`,
    );
  }
  return mdLines.join("\n");
}

/**
 * Deterministically serializes a LogFileData object into a human-readable Markdown string.
 * This function does NOT use AI, ensuring consistent output for the same input.
 * @param data The LogFileData object to serialize.
 * @returns A Markdown string representation.
 */
export function serializeLogFile(data: LogFileData): string {
  const roadmapContent = serializeRoadmap(data.roadmap);
  const workLogContent = serializeWorkLog(data.workLog);

  return (
    JOB_CONTENT_TEMPLATE
      //
      .replace("{{title}}", JSON.stringify(data.title))
      .replace("{{progress}}", JSON.stringify(data.progress))
      .replace("{{raodmap}}", roadmapContent || "_No tasks planned yet._")
      .replace("{{worklog}}", workLogContent || "_No work logged yet._")
  );
}
const JOB_CONTENT_TEMPLATE = `---
title: {{title}}
progress: {{progress}}
---

## Roadmap

{{roadmap}}

## Work Log

{{worklog}}

`;
