import {type LogFileData, type RoadmapTaskNodeData} from "../entities.js";

function serializeRoadmap(tasks: RoadmapTaskNodeData[], level = 0): string {
  const mdLines: string[] = [];

  for (const task of tasks) {
    const indent = "  ".repeat(level);
    const checkbox = task.status === "Completed" ? "[x]" : task.status === "Cancelled" ? "[-]" : "[ ]";
    mdLines.push(`${indent}- ${checkbox} ${task.id} ${task.title}`);

    const subIndent = indent + "  ";
    mdLines.push(`${subIndent}- status: ${task.status}`);
    if (task.executor) mdLines.push(`${subIndent}- executor: ${task.executor}`);
    if (task.description) mdLines.push(`${subIndent}- description: ${task.description}`);
    if (task.dependsOn && task.dependsOn.length > 0) mdLines.push(`${subIndent}- dependsOn: [${task.dependsOn.join(", ")}]`);
    if (task.tags && task.tags.length > 0) mdLines.push(`${subIndent}- tags: [${task.tags.join(", ")}]`);

    // Type guard: Only recurse if the 'children' property exists.
    if ("children" in task && task.children && task.children.length > 0) {
      // We pass sub-tasks to a version of the function that expects them
      const subTaskLines: string[] = task.children.map((subTask) => {
        const subTaskIndent = "  ".repeat(level + 1);
        const subTaskCheckbox = subTask.status === "Completed" ? "[x]" : subTask.status === "Cancelled" ? "[-]" : "[ ]";
        const subTaskSubIndent = subTaskIndent + "  ";

        let subLines = [`${subTaskIndent}- ${subTaskCheckbox} ${subTask.id} ${subTask.title}`];
        subLines.push(`${subTaskSubIndent}- status: ${subTask.status}`);
        if (subTask.executor) subLines.push(`${subTaskSubIndent}- executor: ${subTask.executor}`);

        return subLines.join("\n");
      });
      mdLines.push(...subTaskLines);
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

const JOB_CONTENT_TEMPLATE = (data: {title: string; progress: string; roadmap: string; worklog: string}) => `---
title: ${data.title}
progress: ${data.progress}
---

## Roadmap

${data.roadmap}

## Work Log

${data.worklog}`;

export function serializeLogFile(data: LogFileData): string {
  return JOB_CONTENT_TEMPLATE({
    ...data,
    roadmap: serializeRoadmap(data.roadmap),
    worklog: serializeWorkLog(data.workLog),
  });
}
