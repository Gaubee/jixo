import type {AgentMetadata} from "@jixo/dev/browser";
import React from "react";
import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {CoderAgentConfigPanel} from "./CoderAgentConfigPanel.tsx";
import {LoaderCircle} from "lucide-react";

interface ConfigPanelProps {
  metadata: AgentMetadata;
  isDirty: boolean;
  isGenerating: boolean;
  isLoading: boolean;
  onMetadataChange: (metadata: AgentMetadata) => void;
  onApplyChanges: () => Promise<void>;
  onCancelChanges: () => Promise<void>;
}

export function ConfigPanel({metadata, isDirty, isGenerating, isLoading, onMetadataChange, onApplyChanges, onCancelChanges}: ConfigPanelProps) {
  const agentType = metadata.agent || "coder";

  const handleAgentChange = (value: string) => {
    if (value === "coder") {
      onMetadataChange({
        agent: "coder",
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
          <Label htmlFor="agent-select">Select Agent</Label>
          <Select value={agentType} onValueChange={handleAgentChange}>
            <SelectTrigger id="agent-select" className="w-full">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="coder">Coder Agent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {agentType === "coder" && (
          <div className="border-t pt-4">
            <CoderAgentConfigPanel metadata={metadata} onMetadataChange={onMetadataChange} />
          </div>
        )}
      </CardContent>
      {isDirty && (
        <CardFooter className="flex gap-2 border-t pt-6">
          <Button onClick={onCancelChanges} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button onClick={onApplyChanges} className="flex-1" disabled={isLoading}>
            {isLoading ? "Applying..." : "Apply Changes"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
