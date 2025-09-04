import {type SessionAPI} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import {webSocketEndpoint} from "@jixo/dev/comlink-adapters";
import {createStore, get, set} from "idb-keyval";
export const WS_PORT = 8765;
const pendingRequests = new Map<string, {resolve: (value: any) => void; reject: (reason?: any) => void}>();

const workDirStore = createStore("jixo-workDir", "store");

export const connectSessionApi = async (sessionId: string) => {
  const job = Promise.withResolvers<Comlink.Remote<SessionAPI>>();

  const newSocket = new WebSocket(`ws://127.0.0.1:${WS_PORT}/session/${sessionId}`);

  newSocket.onopen = async () => {
    console.log(`JIXO ISOLATED: Session WebSocket connected for ${sessionId}.`);
    const ep = webSocketEndpoint({webSocket: newSocket, messageChannel: sessionId});
    const api = Comlink.wrap<SessionAPI>(ep);
    const workDir = await get<string>(sessionId, workDirStore);
    if (workDir != null) {
      await api.setWorkDir(workDir);
    } else {
      (async () => {
        // 初始化
        void api.getWorkDir().then((workDir) => {
          set(sessionId, workDir, workDirStore);
        });

        // 监听变动
        while (newSocket.readyState === WebSocket.OPEN) {
          const workDir = await api.whenWorkDirChanged();
          await set(sessionId, workDir, workDirStore);
        }
      })();
    }
    job.resolve(api);
  };

  newSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "RESPONSE" && message.requestId) {
        const promise = pendingRequests.get(message.requestId);
        if (promise) {
          if (message.status === "SUCCESS") {
            promise.resolve(message.payload);
          } else {
            promise.reject(new Error(message.error || "Unknown error from backend."));
          }
          pendingRequests.delete(message.requestId);
        }
      }
    } catch (error) {
      console.error("JIXO ISOLATED: Failed to parse session message:", event.data, error);
    }
  };

  newSocket.onclose = () => {
    console.log("JIXO ISOLATED: Session WebSocket closed.");
    // Reject all pending requests on close
    for (const [requestId, promise] of pendingRequests.entries()) {
      promise.reject(new Error("WebSocket connection closed."));
      pendingRequests.delete(requestId);
    }
  };

  newSocket.onerror = (error) => {
    console.error(`JIXO ISOLATED: Session WebSocket error:`, error);
    job.reject(error);
  };
  const sessionApi = await job.promise;
  const destroySessionApi = () => {
    newSocket.close();
  };
  return {
    sessionApi,
    destroySessionApi,
  };
};
