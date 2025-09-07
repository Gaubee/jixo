import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Switch} from "@/components/ui/switch.tsx";
import React from "react";

interface SettingsPanelProps {
  isSyncEnabled: boolean;
  isLoading: boolean;
  onSyncToggle: (enabled: boolean) => Promise<void>;
  onClearHistory: () => Promise<void>;
}

export function SettingsPanel({isSyncEnabled, isLoading, onSyncToggle, onClearHistory}: SettingsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Settings</CardTitle>
        <CardDescription>Manage global functionalities and user preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 divide-y">
        <div className="flex items-center justify-between pt-4">
          <Label htmlFor="sync-switch" className="flex flex-col gap-1">
            <span>Enable Page Sync</span>
            <span className="text-muted-foreground text-xs font-normal">Automatically sync page content to local files.</span>
          </Label>
          {/* <input type="checkbox" checked={isSyncEnabled} onChange={(e)=>onSyncToggle(e.target.checked)} /> */}
          <Switch id="sync-switch" checked={isSyncEnabled} onCheckedChange={onSyncToggle} />
        </div>
        <div className="space-y-3 pt-4">
          <Button onClick={onClearHistory} className="w-full" variant="secondary" disabled={isLoading}>
            {isLoading ? "Clearing..." : "Clear Page History"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
