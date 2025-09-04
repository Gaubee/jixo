import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {FolderSearch} from "lucide-react";
import React, {useContext, useEffect, useState} from "react";
import type {WorkspaceStatus} from "../hooks/useWorkspace";
import {SessionAPICtx} from "./context";

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
  }, []);
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to JIXO</CardTitle>
          <CardDescription>Please select a project folder to get started.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {workspaceStatus === "browser-ready" && (
            // @JIXO 请美化一下这段界面相关的代码。按钮做成点击复制的功能
            <>
              <div>
                请在指定选中的目录中执行
                <button>
                  <pre className="text-primary select-all p-2">deno run -A jsr:@jixo/cli/session {nid}</pre>
                </button>
              </div>
              <div>
                或者在选中的目录下去运行
                <button>
                  <pre className="text-primary select-all p-2">deno eval "await fetch('http://localhost:8765/init-session?nid={nid}&workDir='+process.cwd())" </pre>
                </button>
              </div>
            </>
          )}

          <Button onClick={onSelectWorkspace} className="w-full" disabled={isLoading}>
            <FolderSearch className="mr-2 h-4 w-4" />
            {workspaceStatus === "browser-ready" ? (
              //
              <span>
                已经选中文件夹： <pre className="text-border inline">{workspaceName}</pre>
              </span>
            ) : //
            isLoading ? (
              "Waiting for selection..."
            ) : (
              "Select Workspace Folder"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
