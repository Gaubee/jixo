import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {FolderSearch} from "lucide-react";
import React from "react";

interface WorkspaceSetupProps {
  onSelectWorkspace: () => Promise<void>;
  isLoading: boolean;
}

export function WorkspaceSetup({onSelectWorkspace, isLoading}: WorkspaceSetupProps) {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to JIXO</CardTitle>
          <CardDescription>Please select a project folder to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onSelectWorkspace} className="w-full" disabled={isLoading}>
            <FolderSearch className="mr-2 h-4 w-4" />
            {isLoading ? "Waiting for selection..." : "Select Workspace Folder"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
