import {useEffect, useState} from "react";
import {getBackgroundAPI} from "../lib/comlink-client.ts";

export type ServiceStatus = "connecting" | "connected" | "disconnected";

export function useServiceStatus() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("connecting");
  const backgroundApi = getBackgroundAPI();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await backgroundApi.getServiceStatus();
        setServiceStatus(status);
      } catch {
        setServiceStatus("disconnected");
      }
    }, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [backgroundApi]);

  return serviceStatus;
}
