import {blue, bold} from "@gaubee/nodekit";
import type {UIRenderCommand, UIResponse} from "@jixo/tools-uikit";
import http from "node:http";
import {WebSocket, WebSocketServer} from "ws";

const wsMap = new Map<string, WebSocket>();
let sessionIdCounter = 0;

// --- Render Service ---
type JobResolver = (response: any) => void;
const jobListeners = new Map<string, JobResolver>();

function handleUserResponse(message: UIResponse) {
  const callback = jobListeners.get(message.jobId);
  if (callback) {
    callback(message.payload);
    jobListeners.delete(message.jobId);
  } else {
    console.warn(`Received response for unknown or timed out job ID: ${message.jobId}`);
  }
}

export const webSocketRenderHandler = (sessionId: string, command: UIRenderCommand): Promise<any> => {
  const ws = wsMap.get(sessionId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error(`No active WebSocket session found for ID: ${sessionId}`));
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

// --- WebSocket Server ---
export function startWsServer(port = 8765) {
  const server = http.createServer();
  const wss = new WebSocketServer({server});

  wss.on("connection", (ws) => {
    const sessionId = `session-${sessionIdCounter++}`;
    wsMap.set(sessionId, ws);
    console.log(blue(`WebSocket client connected: ${bold(sessionId)}`));

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "USER_RESPONSE" && message.jobId) {
          handleUserResponse(message as UIResponse);
        } else {
          console.log(`Received unhandled message from ${sessionId}:`, message);
        }
      } catch (e) {
        console.error(`Error processing message from ${sessionId}:`, e);
      }
    });

    ws.on("close", () => {
      wsMap.delete(sessionId);
      console.log(blue(`WebSocket client disconnected: ${bold(sessionId)}`));
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for ${sessionId}:`, error);
    });

    ws.send(JSON.stringify({type: "WELCOME", sessionId}));
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(blue(`WebSocket server is listening on port ${bold(port.toString())}...`));
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`Port ${port} is already in use. Assuming server is running in another process.`);
    } else {
      console.error("HTTP Server error:", err);
    }
  });
}
