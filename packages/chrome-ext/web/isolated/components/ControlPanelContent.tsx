import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {KeyValStore} from "@jixo/dev/idb-keyval";
import React, {useCallback, useContext, useEffect, useState} from "react";
import {useConfigPanelState} from "../hooks/useConfigPanelState.ts";
import {ConfigPanel} from "./ConfigPanel.tsx";
import {useNotification} from "./Notification.tsx";
import {SettingsPanel} from "./SettingsPanel.tsx";
import {MainAPICtx, PanelSettingsCtx, SessionIdCtx, type PanelSettings} from "./context.ts";

const panelSettingsStore = new KeyValStore<PanelSettings>("jixo-settings");

interface ControlPanelContentProps {}

export function ControlPanelContent({}: ControlPanelContentProps) {
  const mainApi = useContext(MainAPICtx);
  const [panelSettings, setPanelSettings] = useState<PanelSettings>({});
  const {addNotification} = useNotification();
  const sessionId = useContext(SessionIdCtx);

  useEffect(() => {
    panelSettingsStore.get(sessionId).then((storedSettings) => {
      setPanelSettings(storedSettings ?? {isSyncEnabled: true});
    });
  }, [sessionId]);

  const handleAction = async (actionName: string, actionFn: () => Promise<any>, notificationId?: string) => {
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
    }
  };

  const handleSettingsSubmit = useCallback(
    async (values: PanelSettings) => {
      await panelSettingsStore.set(sessionId, values);
      setPanelSettings(values);
    },
    [sessionId],
  );

  /**
   * 防止切换tab的时候
   * 重新执行 useConfigPanelState
   */
  const state = useConfigPanelState();

  // New effect to automatically start/stop sync based on settings and workspace status
  useEffect(() => {
    const {isSyncEnabled = true} = panelSettings;
    const workspaceReady = state.workspaceStatus === "ready";
    // Only perform action if the status should change based on current state
    if (isSyncEnabled && workspaceReady) {
      handleAction("Start Sync", mainApi.startSync, "sync-status");
    } else {
      handleAction("Stop Sync", mainApi.stopSync, "sync-status");
    }
  }, [panelSettings.isSyncEnabled, state.workspaceStatus, mainApi]);
  return (
    <PanelSettingsCtx.Provider value={panelSettings}>
      <Tabs defaultValue="agent">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agent">Agent</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="agent">
          <ConfigPanel state={state} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsPanel
            values={panelSettings}
            onSubmit={handleSettingsSubmit}
            onClearHistory={() => handleAction("Clear History", mainApi.clearPageHistory, "clear-history-status")}
          />
        </TabsContent>
      </Tabs>
    </PanelSettingsCtx.Provider>
  );
}
