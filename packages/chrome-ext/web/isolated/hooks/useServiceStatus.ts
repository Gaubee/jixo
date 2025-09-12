import {delay} from "@jixo/dev/browser";
import {useEffect, useState} from "react";
import {getBackgroundAPI} from "../lib/comlink-client.ts";

export type ServiceStatus = "connecting" | "connected" | "disconnected";

export function useServiceStatus() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("connecting");
  const backgroundApi = getBackgroundAPI();

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      while (!controller.signal.aborted) {
        try {
          const status = await backgroundApi.getServiceStatus();
          setServiceStatus(status);
          await delay(status === "connected" ? 600 : 300);
        } catch {
          setServiceStatus("disconnected");
          await delay(1000);
        }
      }
    })();

    return () => controller.abort();
  }, [backgroundApi]);

  return serviceStatus;
}
