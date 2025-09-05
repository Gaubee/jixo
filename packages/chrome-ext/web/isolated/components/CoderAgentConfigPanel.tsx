import type {CoderAgentMetadata} from "@jixo/dev/browser";
import React from "react";
import {Button} from "@/components/ui/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {FileListInput} from "./FileListInput.tsx";
import {X} from "lucide-react";

interface CoderAgentConfigPanelProps {
  metadata: CoderAgentMetadata;
  onMetadataChange: (metadata: CoderAgentMetadata) => void;
  onPreview: (patterns: string[]) => Promise<string[]>;
}

export function CoderAgentConfigPanel({metadata, onMetadataChange, onPreview}: CoderAgentConfigPanelProps) {
  const handleMcpChange = (index: number, field: "command" | "prefix", value: string) => {
    const newMcp = [...(metadata.mcp || [])];
    newMcp[index] = {...newMcp[index], [field]: value};
    onMetadataChange({...metadata, mcp: newMcp});
  };

  const addMcpItem = () => {
    onMetadataChange({...metadata, mcp: [...(metadata.mcp || []), {command: "", prefix: ""}]});
  };

  const removeMcpItem = (index: number) => {
    onMetadataChange({...metadata, mcp: (metadata.mcp || []).filter((_, i) => i !== index)});
  };

  return (
    <div className="space-y-4">
      <FileListInput
        label="Directories (dirs)"
        values={metadata.dirs || []}
        onChange={(dirs) => onMetadataChange({...metadata, dirs})}
        onPreview={onPreview}
        placeholder="e.g., src/**/*.ts"
      />
      <FileListInput
        label="Documentation (docs)"
        values={metadata.docs || []}
        onChange={(docs) => onMetadataChange({...metadata, docs})}
        onPreview={onPreview}
        placeholder="e.g., docs/architecture.md"
      />
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">MCP Tools</label>
        <div className="max-h-32 space-y-2 overflow-y-auto pr-2">
          {(metadata.mcp || []).map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="text"
                value={item.command}
                onChange={(e) => handleMcpChange(index, "command", e.target.value)}
                placeholder="MCP command (e.g., pnpx mcp-pnpm)"
                className="h-8 flex-grow text-xs"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      type="text"
                      value={item.prefix || ""}
                      onChange={(e) => handleMcpChange(index, "prefix", e.target.value)}
                      placeholder="Prefix"
                      className="h-8 w-24 text-xs"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Optional prefix to avoid tool name collisions.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeMcpItem(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button onClick={addMcpItem} variant="secondary" size="sm">
          Add MCP Tool
        </Button>
      </div>
    </div>
  );
}
