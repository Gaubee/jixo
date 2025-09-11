import {Button} from "@/components/ui/button.tsx";
import {Card, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {FolderSearch} from "lucide-react";
import React from "react";

interface WorkspaceSelectorProps {
  selectedWorkspaceName: string | null;
  onSelect: () => void;
  isLoading: boolean;
}

export function WorkspaceSelector({selectedWorkspaceName, onSelect, isLoading}: WorkspaceSelectorProps) {
  return (
    <div className="p-2">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to JIXO</CardTitle>
          <CardDescription>Please select a project folder to get started.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={onSelect} className="w-full" disabled={isLoading}>
            <FolderSearch className="mr-2 h-4 w-4" />
            {selectedWorkspaceName ?? (isLoading ? "Waiting for selection..." : "Select Workspace Folder")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
