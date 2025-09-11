import React from "react";
import {type ConfigPanelState} from "../hooks/useConfigPanelState.ts";
import {ConfigForm} from "./ConfigForm.tsx";
import {WorkspaceLinker} from "./WorkspaceLinker.tsx";
import {WorkspaceSelector} from "./WorkspaceSelector.tsx";

interface ConfigPanelProps {
  state: ConfigPanelState;
}

export function ConfigPanel({state}: ConfigPanelProps) {
  if (state.workspaceStatus === "ready") {
    return <ConfigForm {...state} />;
  } else {
    return (
      <>
        <WorkspaceSelector selectedWorkspaceName={state.workspaceName} onSelect={state.handleSelectWorkspace} isLoading={state.isSelecting} />
        {state.workspaceStatus === "linking_required" && <WorkspaceLinker workspaceName={state.workspaceName} command1={state.command1} command2={state.command2} />}
      </>
    );
  }
}
