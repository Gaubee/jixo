import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert.tsx";
import {LoaderCircle, WifiOff} from "lucide-react";
import React from "react";
import {useServiceStatus} from "../hooks/useServiceStatus.ts";
import {ControlPanelContent} from "./ControlPanelContent.tsx";
import {NotificationProvider} from "./Notification.tsx";

interface ControlPanelProps {}

export function ControlPanel({}: ControlPanelProps) {
  const serviceStatus = useServiceStatus();

  return (
    <NotificationProvider>
      <div className="w-[max(278px,20vw)] space-y-2 p-2 text-sm">
        {serviceStatus === "disconnected" && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Disconnected</AlertTitle>
            <AlertDescription>Cannot connect to JIXO service. Please run `npx jixo go browser` in your terminal.</AlertDescription>
          </Alert>
        )}
        {serviceStatus === "connecting" && (
          <div className="bg-muted text-muted-foreground flex items-center justify-center rounded-2xl p-4">
            <LoaderCircle className="mr-2 h-6 w-6 animate-spin" />
            <span>Connecting...</span>
          </div>
        )}
        {serviceStatus === "connected" && <ControlPanelContent />}
      </div>
    </NotificationProvider>
  );
}
