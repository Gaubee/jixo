import {type LogFileData, type RoadmapTaskNodeData} from "../entities.js";

function serializeRoadmap(tasks: RoadmapTaskNodeData[], level = 0): string {
  const mdLines: string[] = [];
  const indent = "  ".repeat(level); // 2 spaces for indentation

  for (const task of tasks) {
    const checkbox = task.status === "Completed" ? "[x]" : "[ ]";
    mdLines.push(`${indent}- ${checkbox} ${task.id}. ${task.description}`);

    // Add sub-items for status and runner, as per system.md example
    // We always write the status for clarity and consistency
    const subIndent = "  ".repeat(level + 1);
    mdLines.push(`${subIndent}- status: ${task.status}\n`);
    if (task.runner) {
      mdLines.push(`${subIndent}- runner: ${task.runner}\n`);
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
    mdLines.push(
      //
      `### Log @ ${entry.timestamp} for ${entry.runnerId}\n`,
      `- **Role**: ${entry.role}`,
      `- **Objective**: ${entry.objective}`,
      `- **Result**: ${entry.result}`,
      `- **Summary**: ${entry.summary}\n`,
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
  const frontmatter = `---
title: "${data.title}"
progress: "${data.progress}"
---
`;

  const roadmapContent = serializeRoadmap(data.roadmap);
  const workLogContent = serializeWorkLog(data.workLog);

  return `${frontmatter}
## Roadmap

${roadmapContent || "No tasks planned yet.\n"}
## Work Log

${workLogContent || "No work logged yet.\n"}`;
}
