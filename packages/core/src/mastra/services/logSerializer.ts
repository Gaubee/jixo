import matter from "gray-matter";
import {type LogFileData, type RoadmapTaskNodeData} from "../entities.js";

function serializeRoadmap(tasks: RoadmapTaskNodeData[], level = 0): string {
  const mdLines: string[] = [];
  for (const task of tasks) {
    const indent = "  ".repeat(level);
    const checkbox = task.status === "Completed" ? "[x]" : task.status === "Cancelled" ? "[-]" : "[ ]";
    mdLines.push(`${indent}- ${checkbox} **${task.id}**: ${task.title}`);

    if (task.details.length > 0) {
      mdLines.push(
        `${indent}- **Details**:`,
        ...task.details
          //
          .map((line) => `${indent}  - ${line}`),
        "",
      );
    }

    if (task.checklist.length > 0) {
      mdLines.push(
        `${indent}- **Checklist**:`,
        ...task.checklist
          //
          .map((line) => `${indent}  - ${line}`),
        "",
      );
    }

    if ("children" in task && task.children && task.children.length > 0) {
      mdLines.push(serializeRoadmap(task.children as RoadmapTaskNodeData[], level + 1));
    }
  }
  return mdLines.join("\n");
}

function serializeWorkLog(entries: LogFileData["workLog"]): string {
  const mdLines: string[] = [];
  for (const [index, entry] of Object.entries(entries)) {
    if (mdLines.length > 0) {
      mdLines.push("\n---");
    }
    mdLines.push(
      `### Log #${entries.length - +index} | ${entry.role} @ ${entry.timestamp}`,
      `- **Runner ID**: \`${entry.runnerId}\``,
      `- **Objective**: ${entry.objective}`,
      `- **Result**: **${entry.result}**`,
      `- **Summary**: ${entry.summary}`,
    );
  }
  return mdLines.join("\n");
}

export function serializeLogFile(data: LogFileData): string {
  const content = `
## Roadmap

${serializeRoadmap(data.roadmap) || "_No tasks planned yet._"}

---

## Work Log

${serializeWorkLog(data.workLog) || "_No work logged yet._"}
`;

  return matter.stringify(content, data);
}
