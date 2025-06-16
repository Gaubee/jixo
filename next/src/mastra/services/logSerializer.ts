import {type LogFileData, type RoadmapTaskNodeData} from "../entities.js";

function serializeRoadmap(tasks: RoadmapTaskNodeData[] | undefined, level = 0): string {
  if (!tasks) return "";
  const mdLines: string[] = [];

  for (const task of tasks) {
    const indent = "  ".repeat(level);
    const checkbox = task.status === "Completed" ? "[x]" : task.status === "Cancelled" ? "[-]" : "[ ]";
    mdLines.push(`${indent}- ${checkbox} ${task.id} ${task.title}`);

    const subIndent = indent + "  ";
    // Serialize all new fields for human readability
    mdLines.push(`${subIndent}- status: ${task.status}`);
    if (task.executor) mdLines.push(`${subIndent}- executor: ${task.executor}`);
    if (task.description) mdLines.push(`${subIndent}- description: ${task.description}`);
    if (task.dependsOn && task.dependsOn.length > 0) mdLines.push(`${subIndent}- dependsOn: [${task.dependsOn.join(", ")}]`);
    if (task.tags && task.tags.length > 0) mdLines.push(`${subIndent}- tags: [${task.tags.join(", ")}]`);

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
      mdLines.push("");
    }
    mdLines.push(
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

{{worklog}}`;

export function serializeLogFile(data: LogFileData): string {
  const roadmapContent = serializeRoadmap(data.roadmap);
  const workLogContent = serializeWorkLog(data.workLog);

  return (
    JOB_CONTENT_TEMPLATE
      //
      .replace("{{title}}", JSON.stringify(data.title))
      .replace("{{progress}}", JSON.stringify(data.progress))
      .replace("{{roadmap}}", roadmapContent || "_No tasks planned yet._")
      .replace("{{worklog}}", workLogContent || "_No work logged yet._")
  );
}
