import fs from "node:fs";
import path from "node:path";

for (const name of fs.readdirSync(import.meta.dirname)) {
  if (!name.endsWith(".jsonl")) {
    continue;
  }
  const filename = path.join(import.meta.dirname, name);
  const jsonlContent = fs.readFileSync(filename, "utf-8");
  const jsonlContent2 = jsonlContent
    .split("\n")
    .map((line) => {
      if (!line.startsWith("{")) {
        return line;
      }
      const data = JSON.parse(line);
      if (data.role === "system") {
        data.content = "...";
      }
      if (data.role === "user") {
        data.content = "...";
      }
      if (data.type === "start-step") {
        delete data.request;
      }
      return JSON.stringify(data);
    })
    .join("\n");
  fs.writeFileSync(filename, jsonlContent2);
}
