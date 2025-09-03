import React from "react";
import {CoderAgentConfigPanel} from "./CoderAgentConfigPanel.tsx";
import type { AgentMetadata } from "@jixo/dev/browser";


interface ConfigPanelProps {
  metadata: AgentMetadata;
  onMetadataChange: (metadata: AgentMetadata) => void;
}

export function ConfigPanel({metadata, onMetadataChange}: ConfigPanelProps) {
  const agentType = "coder"; // Hardcoded for now

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="agent-select" className="block text-sm font-medium text-gray-700">
          Select Agent
        </label>
        <select
          id="agent-select"
          value={agentType}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="coder">Coder Agent</option>
          {/* Other agents can be added here */}
        </select>
      </div>
      {agentType === "coder" && <CoderAgentConfigPanel metadata={metadata} onMetadataChange={onMetadataChange} />}
    </div>
  );
}
