import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {FolderSearch} from "lucide-react";
import React, {useContext, useEffect, useState} from "react";
import type {WorkspaceStatus} from "../hooks/useWorkspace.ts";
import {CopyCommandButton} from "./CopyCommandButton.tsx";
import {SessionAPICtx} from "./context.ts";

interface WorkspaceSetupProps {
  workspaceStatus: WorkspaceStatus;
  workspaceName: string;
  onSelectWorkspace: () => Promise<void>;
  isLoading: boolean;
}

export function WorkspaceSetup({workspaceStatus, workspaceName, onSelectWorkspace, isLoading}: WorkspaceSetupProps) {
  const sessionApi = useContext(SessionAPICtx);
  const [nid, setNid] = useState<number>();

  useEffect(() => {
    sessionApi.nid.then(setNid);
  }, [sessionApi]);

  const command1 = `deno run -A jsr:@jixo/cli/session ${nid}`;
  const command2 = `deno eval "await fetch('http://localhost:8765/init-session?nid=${nid}&workDir='+Deno.cwd())"`;

  return (
    <div className="p-2">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to JIXO</CardTitle>
          <CardDescription>Please select a project folder to get started.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {workspaceStatus === "browser-ready" && (
            <div className="bg-muted/50 text-muted-foreground space-y-4 rounded-lg border p-4 text-xs">
              <p className="font-semibold">Next Step: Link Your Workspace</p>
              <p>Please run one of the following commands in your selected workspace terminal (`{workspaceName}`) to complete the connection:</p>
              <div className="space-y-2">
                <p className="font-medium">Option 1 (Recommended):</p>
                <CopyCommandButton command={command1} />
              </div>
              <div className="space-y-2">
                <p className="font-medium">Option 2 (Alternative):</p>
                <CopyCommandButton command={command2} />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={onSelectWorkspace} className="w-full" disabled={isLoading}>
            <FolderSearch className="mr-2 h-4 w-4" />
            {workspaceStatus === "browser-ready" ? (
              <span className="truncate">
                Reselect Folder: <span className="font-mono text-xs">{workspaceName}</span>
              </span>
            ) : isLoading ? (
              "Waiting for selection..."
            ) : (
              "Select Workspace Folder"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
