import type {UIRenderCommand, UIResponse} from "@jixo/tools-uikit";
import {WebSocket} from "ws";
import {globalWsMap, jobListeners} from "../google-aistudio/jixo/ws-server.js";

export const webSocketRenderHandler = (sessionId: string, command: UIRenderCommand): Promise<any> => {
  const ws = [...globalWsMap.values()].at(-1);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error(`No active global WebSocket session found.`));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        jobListeners.delete(command.jobId);
        reject(new Error(`UI render job ${command.jobId} timed out after 5 minutes.`));
      },
      5 * 60 * 1000,
    );

    const callback = (responsePayload: UIResponse["payload"]) => {
      clearTimeout(timeout);
      if (responsePayload.error) {
        reject(new Error(responsePayload.error));
      } else {
        resolve(responsePayload.data);
      }
    };

    jobListeners.set(command.jobId, callback);
    ws.send(JSON.stringify(command));
  });
};
