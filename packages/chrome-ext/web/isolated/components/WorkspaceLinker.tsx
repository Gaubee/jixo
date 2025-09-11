import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import React from "react";
import {CopyCommandButton} from "./CopyCommandButton.tsx";

interface WorkspaceLinkerProps {
  workspaceName: string | null;
  command1: string;
  command2: string;
}

export function WorkspaceLinker({workspaceName, command1, command2}: WorkspaceLinkerProps) {
  return (
    <div className="p-2">
      <Card>
        <CardHeader>
          <CardTitle>Link Your Workspace</CardTitle>
          <CardDescription>Your browser has access, now let's link the local service.</CardDescription>
        </CardHeader>
        <CardContent className="bg-muted/50 text-muted-foreground mx-4 space-y-4 rounded-lg p-4 text-xs">
          <p>Please run one of the following commands in your selected workspace terminal (`{workspaceName}`) to complete the connection:</p>
          <div className="space-y-2">
            <p className="font-medium">Option 1 (Recommended):</p>
            <CopyCommandButton command={command1} />
          </div>
          <div className="space-y-2">
            <p className="font-medium">Option 2 (Alternative):</p>
            <CopyCommandButton command={command2} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
