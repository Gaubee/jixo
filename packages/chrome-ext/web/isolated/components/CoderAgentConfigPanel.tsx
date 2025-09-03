import React from "react";
import {FileListInput} from "./FileListInput.tsx";
import type { CoderAgentMetadata } from "@jixo/dev/browser";

interface CoderAgentConfigPanelProps {
  metadata: CoderAgentMetadata;
  onMetadataChange: (metadata: CoderAgentMetadata) => void;
}

export function CoderAgentConfigPanel({metadata, onMetadataChange}: CoderAgentConfigPanelProps) {
  const handleMcpChange = (index: number, field: "command" | "prefix", value: string) => {
    const newMcp = [...metadata.mcp];
    newMcp[index] = {...newMcp[index], [field]: value};
    onMetadataChange({...metadata, mcp: newMcp});
  };

  const addMcpItem = () => {
    onMetadataChange({...metadata, mcp: [...metadata.mcp, {command: "", prefix: ""}]});
  };

  const removeMcpItem = (index: number) => {
    onMetadataChange({...metadata, mcp: metadata.mcp.filter((_, i) => i !== index)});
  };

  return (
    <div className="space-y-4 p-3 border-t">
      <FileListInput label="Directories (dirs)" values={metadata.dirs} onChange={(dirs) => onMetadataChange({...metadata, dirs})} placeholder="e.g., src/**/*.ts" />
      <FileListInput label="Documentation (docs)" values={metadata.docs} onChange={(docs) => onMetadataChange({...metadata, docs})} placeholder="e.g., docs/architecture.md" />
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">MCP Tools</label>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {metadata.mcp.map((item, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={item.command}
                onChange={(e) => handleMcpChange(index, "command", e.target.value)}
                placeholder="MCP command (e.g., pnpx mcp-pnpm)"
                className="flex-grow block w-full px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm text-xs"
              />
              <input
                type="text"
                value={item.prefix}
                onChange={(e) => handleMcpChange(index, "prefix", e.target.value)}
                placeholder="Prefix (optional)"
                className="block w-24 px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm text-xs"
              />
              <button onClick={() => removeMcpItem(index)} className="text-red-500 hover:text-red-700 px-1">
                &times;
              </button>
            </div>
          ))}
        </div>
        <button onClick={addMcpItem} className="text-xs px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
          Add MCP Tool
        </button>
      </div>
    </div>
  );
}
