import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {isEqualCanonical} from "@/lib/utils.ts";
import type {AgentMetadata, PageConfig} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import {del, get, set} from "idb-keyval";
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

const initialConfig: PageConfig = {
  metadata: initialMetadata,
  model: "",
  systemPrompt: "",
  tools: [],
};

export function ControlPanelContent({workDirFullpath, onSelectWorkspace, mainApi, isolatedApi}: ControlPanelContentProps) {
  const [activeConfig, setActiveConfig] = useState<PageConfig>(initialConfig);
  const [stagedConfig, setStagedConfig] = useState<PageConfig>(initialConfig);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const {addNotification} = useNotification();
  const sessionId = useContext(SessionIdCtx);

  const stagedConfigKey = `staged-config-${sessionId}`;

  // Effect for initializing and synchronizing state from storage
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const syncState = async () => {
      try {
        const loadedActiveConfig = (await mainApi.readConfigFile(sessionId, false)) || initialConfig;
        setActiveConfig(loadedActiveConfig);
        const loadedStagedConfig = await get<PageConfig>(stagedConfigKey);
        setStagedConfig(loadedStagedConfig || loadedActiveConfig);
      } catch (err) {
        addNotification("error", "Failed to initialize configuration.");
      }
    };

    const watchForChanges = async () => {
      await syncState();
      let configSnap = await mainApi.getConfigFileSnap(sessionId, false);
      let dispose = () => {};

      while (!signal.aborted) {
        try {
          const whenChange = await mainApi.whenFileChanged(`${sessionId}.config.json`, configSnap, {strategy: "stat"});
          dispose = () => whenChange.dispose();
          const {newSnap} = await whenChange.promise;
          dispose = () => {};
          configSnap = newSnap;
          if (!isDirty) {
            await syncState();
          }
        } catch (error) {
          if (error instanceof Error && error.name !== "AbortError") {
            console.error("File watcher error:", error);
            await new Promise((res) => setTimeout(res, 5000));
          } else {
            break;
          }
        } finally {
          dispose();
        }
      }
    };

    watchForChanges();
    return () => controller.abort();
  }, [sessionId, mainApi, addNotification, stagedConfigKey, isDirty]);

  // Effect for calculating dirtiness
  useEffect(() => {
    setIsDirty(!isEqualCanonical(activeConfig, stagedConfig));
  }, [activeConfig, stagedConfig]);

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

  const handleMetadataChange = async (newMetadata: AgentMetadata) => {
    setIsGenerating(true);
    try {
      const newStagedConfig = await isolatedApi.generateConfigFromMetadata(sessionId, newMetadata);
      setStagedConfig(newStagedConfig);
      await set(stagedConfigKey, newStagedConfig);
    } catch (err) {
      addNotification("error", "Failed to generate config template.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyChanges = async () => {
    await handleAction("Apply Config", async () => {
      await mainApi.writeConfigFile(sessionId, false, JSON.stringify(stagedConfig, null, 2));
      await mainApi.applyConfigFile(sessionId);
      setActiveConfig(stagedConfig);
      await del(stagedConfigKey);
    });
  };

  const handleCancelChanges = async () => {
    setStagedConfig(activeConfig);
    await del(stagedConfigKey);
    addNotification("info", "Changes have been discarded.");
  };

  return (
    <Tabs defaultValue="configuration">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="configuration">Configuration</TabsTrigger>
        <TabsTrigger value="synchronization">Synchronization</TabsTrigger>
      </TabsList>
      <TabsContent value="configuration">
        <ConfigPanel
          metadata={stagedConfig.metadata || initialMetadata}
          onMetadataChange={handleMetadataChange}
          isDirty={isDirty}
          isGenerating={isGenerating}
          isLoading={isLoading["Apply Config"] || false}
          onApplyChanges={handleApplyChanges}
          onCancelChanges={handleCancelChanges}
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
