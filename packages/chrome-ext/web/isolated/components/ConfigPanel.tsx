import React from "react";
import {useConfigPanelState} from "../hooks/useConfigPanelState.ts";
import {ConfigForm} from "./ConfigForm.tsx";
import {WorkspaceLinker} from "./WorkspaceLinker.tsx";
import {WorkspaceSelector} from "./WorkspaceSelector.tsx";

export function ConfigPanel() {
  const state = useConfigPanelState();

  if (state.workspaceStatus === "missing_handle") {
    return <WorkspaceSelector onSelect={state.handleSelectWorkspace} isLoading={state.isSelecting} />;
  }

  if (state.workspaceStatus === "linking_required") {
    return <WorkspaceLinker workspaceName={state.workspaceName} command1={state.command1} command2={state.command2} />;
  }

  if (state.workspaceStatus === "ready") {
    return <ConfigForm {...state} />;
  }

  return null; // Or a loading spinner
}
