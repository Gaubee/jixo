import type {AgentMetadata} from "@jixo/dev/browser";
import React from "react";
import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {CoderAgentConfigPanel} from "./CoderAgentConfigPanel.tsx";

interface ConfigPanelProps {
  metadata: AgentMetadata;
  onMetadataChange: (metadata: AgentMetadata) => void;
  onGenerateConfig: () => Promise<void>;
}

export function ConfigPanel({metadata, onMetadataChange, onGenerateConfig}: ConfigPanelProps) {
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
        <CardTitle>Agent Configuration</CardTitle>
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
          <div className="pt-4 border-t">
            <CoderAgentConfigPanel metadata={metadata} onMetadataChange={onMetadataChange} />
          </div>
        )}

        <div className="pt-4 border-t">
          <Button onClick={onGenerateConfig} className="w-full">
            Generate Config Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
