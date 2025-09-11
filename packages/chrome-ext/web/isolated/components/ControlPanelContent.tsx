import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {KeyValStore} from "@jixo/dev/idb-keyval";
import React, {useContext, useEffect, useState} from "react";
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

  const handleSettingsSubmit = async (values: PanelSettings) => {
    const {isSyncEnabled = true} = values;
    setPanelSettings({isSyncEnabled});
    await panelSettingsStore.set(sessionId, {isSyncEnabled});
    const actionName = isSyncEnabled ? "Start Sync" : "Stop Sync";
    const actionFn = isSyncEnabled ? mainApi.startSync : mainApi.stopSync;
    await handleAction(actionName, actionFn, "sync-status");
  };

  return (
    <PanelSettingsCtx.Provider value={panelSettings}>
      <Tabs defaultValue="agent">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agent">Agent</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="agent">
          <ConfigPanel />
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
