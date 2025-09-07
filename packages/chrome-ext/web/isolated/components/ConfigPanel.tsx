import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import type {AgentMetadata, CoderAgentMetadata} from "@jixo/dev/browser";
import {FolderSearch, LoaderCircle} from "lucide-react";
import React from "react";
import {CoderAgentConfigPanel} from "./CoderAgentConfigPanel.tsx";

interface ConfigPanelProps {
  metadata: AgentMetadata;
  isDirty: boolean;
  isGenerating: boolean;
  isLoading: boolean;
  onMetadataChange: (metadata: AgentMetadata) => void;
  onApplyChanges: () => Promise<void>;
  onCancelChanges: () => Promise<void>;
  onPreview: (patterns: string[]) => Promise<string[]>;
  onSelectWorkspace: () => Promise<void>;
}

export function ConfigPanel({metadata, isDirty, isGenerating, isLoading, onMetadataChange, onApplyChanges, onCancelChanges, onPreview, onSelectWorkspace}: ConfigPanelProps) {
  const agentType = metadata.agent || "coder";

  const handleAgentChange = (value: string) => {
    if (value === "coder") {
      onMetadataChange({
        agent: "coder",
        codeName: metadata.codeName,
        workDir: metadata.workDir,
        dirs: metadata.dirs || [],
        docs: metadata.docs || [],
        mcp: metadata.mcp || [],
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Agent Configuration</span>
          {isGenerating && <LoaderCircle className="text-muted-foreground size-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Workspace (workDir)</Label>
          <Button onClick={onSelectWorkspace} variant="outline" className="w-full justify-start text-left font-mono">
            <FolderSearch className="mr-2 h-4 w-4" />
            <span className="truncate">{metadata.workDir || "Click to select..."}</span>
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-select">Agent</Label>
          <Select value={agentType} onValueChange={handleAgentChange}>
            <SelectTrigger id="agent-select" className="w-full">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="coder">Coder Agent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t pt-4">
          {agentType === "coder" && <CoderAgentConfigPanel metadata={metadata as CoderAgentMetadata} onMetadataChange={onMetadataChange} onPreview={onPreview} />}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 border-t pt-6">
        <Button onClick={onCancelChanges} variant="outline" className="flex-1" disabled={!isDirty || isLoading}>
          Cancel
        </Button>
        <Button onClick={onApplyChanges} className="flex-1" disabled={!isDirty || isLoading}>
          {isLoading ? "Applying..." : "Apply Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
