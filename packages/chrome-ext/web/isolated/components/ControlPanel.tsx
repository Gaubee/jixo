import {useDebounce} from "@uidotdev/usehooks";
import React, {useEffect, useState} from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api";
import {ConfigPanel, type AgentMetadata} from "./ConfigPanel.tsx";
import * as Comlink from "comlink";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {Toaster, toast} from "@/components/ui/sonner.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert.tsx";
import {Terminal} from "lucide-react";

interface ControlPanelProps {
  workspaceName: string;
  mainApi: Comlink.Remote<MainContentScriptAPI>;
  onGenerateConfig: (metadata: AgentMetadata) => Promise<any>;
  onApplyTemplate: () => Promise<{status: string; message?: string}>;
  onApplyConfig: () => Promise<{status: string; message?: string}>;
  onStartSync: () => Promise<{status: string; message?: string}>;
}

const initialMetadata: AgentMetadata = {
  agent: "coder",
  dirs: [],
  docs: [],
  mcp: [],
};

export function ControlPanel({workspaceName, mainApi, onGenerateConfig, onApplyTemplate, onApplyConfig, onStartSync}: ControlPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<AgentMetadata>(initialMetadata);
  const [configDiffers, setConfigDiffers] = useState(false);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  const handleAction = async (actionName: string, actionFn: () => Promise<any>) => {
    setIsLoading((prev) => ({...prev, [actionName]: true}));
    setError(null);
    try {
      await actionFn();
      toast.success(`${actionName} completed successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading((prev) => ({...prev, [actionName]: false}));
    }
  };

  // Load initial metadata from config.json
  useEffect(() => {
    mainApi
      .readConfigFile(false)
      .then((config) => {
        if (config?.metadata) {
          setMetadata(config.metadata);
        }
      })
      .catch(() => {
        // Ignore if file doesn't exist
      });
  }, [mainApi]);

  // Periodically check for differences between config and template
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [config, template] = await Promise.all([mainApi.readConfigFile(false), mainApi.readConfigFile(true)]);
        setConfigDiffers(!!template && JSON.stringify(config) !== JSON.stringify(template));
      } catch {
        setConfigDiffers(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [mainApi]);

  const debouncedWriteMetadata = useDebounce(async (newMetadata: AgentMetadata) => {
    try {
      const currentConfig = (await mainApi.readConfigFile(false)) || {};
      await mainApi.writeConfigFile({...currentConfig, metadata: newMetadata}, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metadata.");
    }
  }, 500);

  const handleMetadataChange = (newMetadata: AgentMetadata) => {
    setMetadata(newMetadata);
    debouncedWriteMetadata(newMetadata);
  };

  return (
    <div className="p-2 space-y-2 text-sm">
      <Toaster />
      <Tabs defaultValue="configuration">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="synchronization">Synchronization</TabsTrigger>
        </TabsList>
        <TabsContent value="configuration">
          <ConfigPanel metadata={metadata} onMetadataChange={handleMetadataChange} onGenerateConfig={() => handleAction("Generate Config", () => onGenerateConfig(metadata))} />
        </TabsContent>
        <TabsContent value="synchronization">
          <Card>
            <CardHeader>
              <CardTitle>Workspace & Sync</CardTitle>
              <CardDescription>Manage your local workspace and page synchronization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-2 border rounded bg-muted text-muted-foreground">
                <strong>Workspace:</strong> <code className="ml-2 bg-background px-1 rounded">{workspaceName}</code>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <Button onClick={() => handleAction("Start Sync", onStartSync)} className="w-full" disabled={isLoading["Start Sync"]}>
                  {isLoading["Start Sync"] ? "Starting..." : "Start Page Sync"}
                </Button>
                <Button
                  onClick={() => handleAction("Apply Template", onApplyTemplate)}
                  className="w-full"
                  variant="secondary"
                  disabled={!configDiffers || isLoading["Apply Template"]}
                >
                  {isLoading["Apply Template"] ? "Applying..." : "Apply Template to Config"}
                </Button>
                <Button onClick={() => handleAction("Apply Config", onApplyConfig)} className="w-full" disabled={isLoading["Apply Config"]}>
                  {isLoading["Apply Config"] ? "Applying..." : "Apply Config to Page"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
