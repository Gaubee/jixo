import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert.tsx";
import {Comlink} from "@jixo/dev/comlink";
import {LoaderCircle, WifiOff} from "lucide-react";
import React from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api.ts";
import {useServiceStatus} from "../hooks/useServiceStatus.ts";
import {useWorkspace} from "../hooks/useWorkspace.ts";
import type {IsolatedContentScriptAPI} from "../lib/content-script-api.tsx";
import {ControlPanelContent} from "./ControlPanelContent.tsx";
import {NotificationProvider} from "./Notification.tsx";
import {WorkspaceSetup} from "./WorkspaceSetup.tsx";

interface ControlPanelProps {
  mainApi: Comlink.Remote<MainContentScriptAPI>;
  isolatedApi: IsolatedContentScriptAPI;
}

export function ControlPanel({mainApi, isolatedApi}: ControlPanelProps) {
  const serviceStatus = useServiceStatus();
  const {workspaceStatus, workspaceName, workDirFullpath, selectWorkspace, isLoading} = useWorkspace(mainApi, isolatedApi);

  return (
    <NotificationProvider>
      <div className="space-y-2 p-2 text-sm">
        {serviceStatus === "disconnected" && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Disconnected</AlertTitle>
            <AlertDescription>Cannot connect to JIXO service. Please run `deno run -A jsr:@jixo/cli/start ` in your terminal.</AlertDescription>
          </Alert>
        )}
        {serviceStatus === "connecting" && (
          <div className="bg-muted text-muted-foreground flex items-center justify-center rounded-2xl p-4">
            <LoaderCircle className="mr-2 h-6 w-6 animate-spin" />
            <span>Connecting...</span>
          </div>
        )}
        {serviceStatus === "connected" &&
          (workspaceStatus === "ready" ? (
            <ControlPanelContent workDirFullpath={workDirFullpath} onSelectWorkspace={selectWorkspace} mainApi={mainApi} isolatedApi={isolatedApi} />
          ) : (
            <WorkspaceSetup workspaceName={workspaceName} workspaceStatus={workspaceStatus} onSelectWorkspace={selectWorkspace} isLoading={isLoading} />
          ))}
      </div>
    </NotificationProvider>
  );
}
