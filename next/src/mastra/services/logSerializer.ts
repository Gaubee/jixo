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
  for (const [index, entry] of Object.entries(entries)) {
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
      `### Log-${entries.length - +index} @ ${entry.timestamp} for ${entry.runnerId}`,
      "",
      `- **Role**: ${entry.role}`,
      `- **Objective**: ${entry.objective}`,
      `- **Result**: ${entry.result}`,
      `- **Summary**: ${entry.summary}`,
    );
  }
  return mdLines.join("\n");
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
      /**
       * <!--[[
       * 不要质疑我这里JSON.stringify的用法，你要记着保持谦逊，只要是我对你的代码做出修改的，基本都要以我为准，除非我有明确用`<!--[[...]]-->`去要求你做出修改，或者你如果觉得我有明显的错误，那么可以在下次对话中提出疑问。
       * 这里是要在markdown的yaml内容里做注入，如果你做stringify，就会有转译的问题，可能会导致格式错误，比如title里头如果有`"`字符，格式就会错误。
       * ]]--> */
      .replace("{{title}}", JSON.stringify(data.title))
      .replace("{{progress}}", JSON.stringify(data.progress))
      .replace("{{roadmap}}", roadmapContent || "_No tasks planned yet._")
      .replace("{{worklog}}", workLogContent || "_No work logged yet._")
  );
}
