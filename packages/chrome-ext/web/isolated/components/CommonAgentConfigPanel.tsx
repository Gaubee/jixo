import React from "react";
import {ToolsSwitchList, type ToolsSwithListProps} from "./ToolsSwitchList.tsx";

interface CommonAgentConfigPanelProps extends ToolsSwithListProps {
  onPreview: (patterns: string[]) => Promise<string[]>;
}
export function CommonAgentConfigPanel({control, tools, onPreview}: CommonAgentConfigPanelProps) {
  return (
    <div className="space-y-4">
      <ToolsSwitchList control={control} tools={tools} />
    </div>
  );
}
