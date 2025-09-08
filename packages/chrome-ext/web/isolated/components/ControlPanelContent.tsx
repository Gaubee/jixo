import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {isEqualCanonical} from "@/lib/utils.ts";
import type {AgentMetadata, PageConfig} from "@jixo/dev/browser";
import {KeyValStore} from "@jixo/dev/idb-keyval";
import {useDebounce} from "@uidotdev/usehooks";
import React, {useContext, useEffect, useRef, useState} from "react";
import {ConfigPanel, type AgentFormValues} from "./ConfigPanel.tsx";
import {useNotification} from "./Notification.tsx";
import {SettingsPanel} from "./SettingsPanel.tsx";
import {IsolatedAPICtx, MainAPICtx, SessionAPICtx, SessionIdCtx} from "./context.ts";

const agentConfigStore = new KeyValStore<PageConfig>("agent-config");
const settingsStore = new KeyValStore<{isSyncEnabled?: boolean}>("jixo-settings");

// Helper hook for detailed logging
function useDebugLog(componentName: string, state: Record<string, any>) {
  const prev = useRef(state);
  useEffect(() => {
    const changedProps: Record<string, {from: any; to: any}> = {};
    Object.keys({...prev.current, ...state}).forEach((key) => {
      if (!isEqualCanonical(prev.current[key], state[key])) {
        changedProps[key] = {from: prev.current[key], to: state[key]};
      }
    });
    if (Object.keys(changedProps).length > 0) {
      console.log(`[${componentName}] Rerender. Changes:`, JSON.parse(JSON.stringify(changedProps)));
    }
    prev.current = state;
  });
}

const initialMetadata: AgentMetadata = {
  agent: "coder",
  codeName: "",
  workDir: "",
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

interface ControlPanelContentProps {
  workDirFullpath: string;
  onSelectWorkspace: () => Promise<void>;
}

export function ControlPanelContent({workDirFullpath, onSelectWorkspace}: ControlPanelContentProps) {
  const mainApi = useContext(MainAPICtx);
  const isolatedApi = useContext(IsolatedAPICtx);
  const [activeConfig, setActiveConfig] = useState<PageConfig>(initialConfig);
  const [stagedConfig, setStagedConfig] = useState<PageConfig>(initialConfig);
  const debouncedMetadata = useDebounce(stagedConfig.metadata, 300);

  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState({isSyncEnabled: true});
  const {addNotification} = useNotification();
  const sessionId = useContext(SessionIdCtx);
  const sessionApi = useContext(SessionAPICtx);

  const stagedConfigKey = `staged-config-${sessionId}`;
  useDebugLog("ControlPanelContent", {activeConfig, stagedConfig, isDirty, isLoading, isGenerating, settings});

  // Effect for initializing settings
  useEffect(() => {
    settingsStore.get(sessionId).then((storedSettings) => {
      setSettings({isSyncEnabled: storedSettings?.isSyncEnabled ?? true});
    });
  }, [sessionId]);

  // Effect for initializing and synchronizing state from storage
  useEffect(() => {
    console.log("[EFFECT 1 - Watcher] Initializing and watching for file changes...");
    const controller = new AbortController();
    const signal = controller.signal;

    const syncState = async () => {
      console.log("[syncState] Starting atomic sync...");
      try {
        const [loadedActiveConfigFromFile, loadedStagedConfigFromDB] = await Promise.all([mainApi.readConfigFile(sessionId, false), agentConfigStore.get(stagedConfigKey)]);

        const finalActiveConfig = loadedActiveConfigFromFile || initialConfig;
        const finalStagedConfig = loadedStagedConfigFromDB || finalActiveConfig;

        console.log("[syncState] Read complete. Setting states now.");
        setActiveConfig(finalActiveConfig);
        setStagedConfig(finalStagedConfig);
        console.log("[syncState] Atomic sync complete.");
      } catch (err) {
        addNotification({type: "error", message: "Failed to initialize configuration."});
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
            console.log("[WATCHER] File changed and not dirty, re-syncing state.");
            await syncState();
          } else {
            console.log("[WATCHER] File changed but state is dirty, skipping sync.");
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
    return () => {
      console.log("[EFFECT 1 - Watcher] Cleanup: Aborting file watcher.");
      controller.abort();
    };
  }, [sessionId, mainApi, addNotification, stagedConfigKey]);

  // Effect for calculating dirtiness
  useEffect(() => {
    console.log("[EFFECT 2 - Dirtiness] Calculating...");
    const newIsDirty = !isEqualCanonical(activeConfig, stagedConfig);
    if (isDirty !== newIsDirty) {
      console.log(`[EFFECT 2 - Dirtiness] State changed to: ${newIsDirty}`);
      setIsDirty(newIsDirty);
    }
  }, [activeConfig, stagedConfig, isDirty]);

  // Effect for debounced config generation
  useEffect(() => {
    const generate = async () => {
      if (!debouncedMetadata || !isDirty) {
        return;
      }

      console.log("[EFFECT 3 - Debounce] Starting generation for metadata...");
      setIsGenerating(true);
      try {
        const newGeneratedConfig = await isolatedApi.generateConfigFromMetadata(sessionId, debouncedMetadata);
        console.log("[EFFECT 3 - Debounce] Generation complete, merging result.");
        setStagedConfig((current) => {
          const finalConfig = {
            ...newGeneratedConfig,
            metadata: current.metadata,
          };
          console.log("[EFFECT 3 - Debounce] Persisting merged config to idb-keyval.");
          agentConfigStore.set(stagedConfigKey, finalConfig);
          return finalConfig;
        });
      } catch (err) {
        addNotification({type: "error", message: "Failed to generate config template."});
      } finally {
        setIsGenerating(false);
      }
    };
    generate();
  }, [debouncedMetadata, isDirty, isolatedApi, sessionId, stagedConfigKey, addNotification]);

  const handleAction = async (actionName: string, actionFn: () => Promise<any>, notificationId?: string) => {
    setIsLoading((prev) => ({...prev, [actionName]: true}));
    if (notificationId) {
      addNotification({id: notificationId, type: "info", message: `${actionName}...`, duration: 0});
    }
    try {
      await actionFn();
      if (notificationId) {
        addNotification({id: notificationId, type: "success", message: `${actionName} completed successfully.`});
      } else {
        addNotification({type: "success", message: `${actionName} completed successfully.`});
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      if (notificationId) {
        addNotification({id: notificationId, type: "error", message: errorMessage, duration: 0});
      } else {
        addNotification({type: "error", message: errorMessage});
      }
    } finally {
      setIsLoading((prev) => ({...prev, [actionName]: false}));
    }
  };

  const handleValuesChange = (values: AgentFormValues) => {
    console.log("[HANDLER] handleValuesChange (from form) called with:", values);
    setStagedConfig((prev) => ({...prev, metadata: values.metadata as AgentMetadata}));
  };

  const handleApplyChanges = async () => {
    console.log("[HANDLER] handleApplyChanges called.");
    await handleAction("Apply Config", async () => {
      await mainApi.writeConfigFile(sessionId, false, JSON.stringify(stagedConfig, null, 2));
      await mainApi.applyConfigFile(sessionId);
      setActiveConfig(stagedConfig);
      await agentConfigStore.del(stagedConfigKey);
      console.log("[HANDLER] Apply complete.");
    });
  };

  const handleCancelChanges = async () => {
    console.log("[HANDLER] handleCancelChanges called.");
    setStagedConfig(activeConfig);
    await agentConfigStore.del(stagedConfigKey);
    addNotification({type: "info", message: "Changes have been discarded."});
    console.log("[HANDLER] Cancel complete.");
  };

  const handlePreview = (patterns: string[]) => {
    return sessionApi.globFiles(patterns);
  };

  const handleInitTools = async () => {
    await handleAction("Initialize Tools", () => sessionApi.initToolsInWorkspace(), "init-tools-status");
  };

  const handleSettingsSubmit = async (values: {isSyncEnabled?: boolean}) => {
    const {isSyncEnabled = true} = values;
    setSettings({isSyncEnabled});
    await settingsStore.set(sessionId, {isSyncEnabled});
    const actionName = isSyncEnabled ? "Start Sync" : "Stop Sync";
    const actionFn = isSyncEnabled ? mainApi.startSync : mainApi.stopSync;
    await handleAction(actionName, actionFn, "sync-status");
  };

  return (
    <Tabs defaultValue="agent">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="agent">Agent</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="agent">
        <ConfigPanel
          values={{metadata: {...(stagedConfig.metadata ?? initialMetadata), workDir: workDirFullpath}}}
          onValuesChange={handleValuesChange}
          isDirty={isDirty}
          isGenerating={isGenerating}
          isLoading={isLoading["Apply Config"] || false}
          onApplyChanges={handleApplyChanges}
          onCancelChanges={handleCancelChanges}
          onPreview={handlePreview}
          onSelectWorkspace={onSelectWorkspace}
          onInitTools={handleInitTools}
        />
      </TabsContent>
      <TabsContent value="settings">
        <SettingsPanel
          initialValues={settings}
          isLoading={isLoading["Clear History"] || isLoading["Initialize Tools"] || false}
          onSubmit={handleSettingsSubmit}
          onClearHistory={() => handleAction("Clear History", mainApi.clearPageHistory, "clear-history-status")}
        />
      </TabsContent>
    </Tabs>
  );
}
