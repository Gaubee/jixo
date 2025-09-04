import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import type {AgentMetadata} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import React, {useContext, useEffect, useState} from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api";
import type {IsolatedContentScriptAPI} from "../lib/content-script-api.tsx";
import {ConfigPanel} from "./ConfigPanel.tsx";
import {useNotification} from "./Notification.tsx";
import {SessionIdCtx} from "./context.ts";

interface ControlPanelContentProps {
  workDirFullpath: string;
  onSelectWorkspace: () => Promise<void>;
  mainApi: Comlink.Remote<MainContentScriptAPI>;
  isolatedApi: IsolatedContentScriptAPI;
}

const initialMetadata: AgentMetadata = {
  agent: "coder",
  dirs: [],
  docs: [],
  mcp: [],
};

export function ControlPanelContent({workDirFullpath, onSelectWorkspace, mainApi, isolatedApi}: ControlPanelContentProps) {
  const [metadata, setMetadata] = useState<AgentMetadata>(initialMetadata);
  const [configDiffers, setConfigDiffers] = useState(false);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const {addNotification} = useNotification();
  const sessionId = useContext(SessionIdCtx);

  const handleAction = async (actionName: string, actionFn: () => Promise<any>) => {
    setIsLoading((prev) => ({...prev, [actionName]: true}));
    try {
      await actionFn();
      addNotification("success", `${actionName} completed successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      addNotification("error", errorMessage);
    } finally {
      setIsLoading((prev) => ({...prev, [actionName]: false}));
    }
  };

  useEffect(() => {
    mainApi
      .readConfigFile(sessionId, false)
      .then((config) => {
        if (config?.metadata) {
          setMetadata(config.metadata);
        }
      })
      .catch(() => {});
  }, [mainApi]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [config, template] = await Promise.all([mainApi.readConfigFile(sessionId, false), mainApi.readConfigFile(sessionId, true)]);
        setConfigDiffers(!!template && JSON.stringify(config) !== JSON.stringify(template));
      } catch {
        setConfigDiffers(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [mainApi]);

  const handleMetadataChange = async (newMetadata: AgentMetadata) => {
    setMetadata(newMetadata);
    try {
      const currentConfig = (await mainApi.readConfigFile(sessionId, false)) || {};
      await mainApi.writeConfigFile(sessionId, false, JSON.stringify({...currentConfig, metadata: newMetadata}, null, 2));
    } catch (err) {
      addNotification("error", err instanceof Error ? err.message : "Failed to save metadata.");
    }
  };

  return (
    <Tabs defaultValue="configuration">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="configuration">Configuration</TabsTrigger>
        <TabsTrigger value="synchronization">Synchronization</TabsTrigger>
      </TabsList>
      <TabsContent value="configuration">
        <ConfigPanel
          metadata={metadata}
          onMetadataChange={handleMetadataChange}
          onGenerateConfig={() => handleAction("Generate Config", () => isolatedApi.generateConfigFromMetadata(sessionId, metadata))}
        />
      </TabsContent>
      <TabsContent value="synchronization">
        <Card>
          <CardHeader>
            <CardTitle>Workspace & Sync</CardTitle>
            <CardDescription>Manage your local workspace and page synchronization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted text-muted-foreground rounded border p-2">
              <strong>Workspace:</strong> <Button onClick={onSelectWorkspace}>{workDirFullpath}</Button>
            </div>
            <div className="space-y-3 border-t pt-4">
              <Button onClick={() => handleAction("Start Sync", mainApi.startSync)} className="w-full" disabled={isLoading["Start Sync"]}>
                {isLoading["Start Sync"] ? "Starting..." : "Start Page Sync"}
              </Button>
              <Button
                onClick={() => handleAction("Apply Template", () => mainApi.applyTemplateConfigFile(sessionId))}
                className="w-full"
                variant="secondary"
                disabled={!configDiffers || isLoading["Apply Template"]}
              >
                {isLoading["Apply Template"] ? "Applying..." : "Apply Template to Config"}
              </Button>
              <Button onClick={() => handleAction("Apply Config", () => mainApi.applyConfigFile(sessionId))} className="w-full" disabled={isLoading["Apply Config"]}>
                {isLoading["Apply Config"] ? "Applying..." : "Apply Config to Page"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
