import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {FolderSearch} from "lucide-react";
import React from "react";

interface WorkspaceSelectorProps {
  onSelect: () => void;
  isLoading: boolean;
}

export function WorkspaceSelector({onSelect, isLoading}: WorkspaceSelectorProps) {
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
            {isLoading ? "Waiting for selection..." : "Select Workspace Folder"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
