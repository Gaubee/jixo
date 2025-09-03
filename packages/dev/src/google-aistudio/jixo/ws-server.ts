import {blue, bold} from "@gaubee/nodekit";
import type {UIRenderCommand, UIResponse} from "@jixo/tools-uikit";
import http from "node:http";
import {URL} from "node:url";
import {WebSocket, WebSocketServer} from "ws";
import {genPageConfig} from "../node/config.js";

const globalWsMap = new Map<string, WebSocket>();
const sessionWsMap = new Map<string, WebSocket>();
let globalSessionIdCounter = 0;

// --- Render Service (Global Channel) ---
type JobResolver = (response: any) => void;
const jobListeners = new Map<string, JobResolver>();

function handleGlobalUserResponse(message: UIResponse) {
  const callback = jobListeners.get(message.jobId);
  if (callback) {
    callback(message.payload);
    jobListeners.delete(message.jobId);
  } else {
    console.warn(`Received response for unknown or timed out job ID: ${message.jobId}`);
  }
}

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

// --- Session-level Request Handler ---
async function handleSessionRequest(sessionId: string, message: any) {
  const ws = sessionWsMap.get(sessionId);
  if (!ws) return;

  const {type, requestId, payload} = message;

  try {
    let result: any;
    switch (type) {
      case "generateConfigFromMetadata":
        result = await genPageConfig({
          sessionId,
          workDir: payload.workDir,
          metadata: payload.metadata,
          outputFilename: `${sessionId}.config-template.json`,
        });
        break;
      default:
        throw new Error(`Unknown request type: ${type}`);
    }
    ws.send(JSON.stringify({type: "RESPONSE", requestId, status: "SUCCESS", payload: result}));
  } catch (error) {
    ws.send(JSON.stringify({type: "RESPONSE", requestId, status: "ERROR", error: error instanceof Error ? error.message : String(error)}));
  }
}

// --- WebSocket Server ---
export function startWsServer(port = 8765) {
  const server = http.createServer();
  const wss = new WebSocketServer({noServer: true});

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url || "/", `ws://${request.headers.host}`);
    const sessionIdMatch = url.pathname.match(/^\/session\/([^/]+)/);

    if (sessionIdMatch) {
      // Session-specific connection
      const sessionId = sessionIdMatch[1];
      sessionWsMap.set(sessionId, ws);
      console.log(blue(`WebSocket session client connected: ${bold(sessionId)}`));

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "REQUEST" && message.requestId) {
            handleSessionRequest(sessionId, message);
          }
        } catch (e) {
          console.error(`Error processing message from session ${sessionId}:`, e);
        }
      });

      ws.on("close", () => {
        sessionWsMap.delete(sessionId);
        console.log(blue(`WebSocket session client disconnected: ${bold(sessionId)}`));
      });

      ws.on("error", (error) => console.error(`WebSocket error for session ${sessionId}:`, error));
      ws.send(JSON.stringify({type: "SESSION_WELCOME", sessionId}));
    } else {
      // Global connection (from background script)
      const globalId = `global-${globalSessionIdCounter++}`;
      globalWsMap.set(globalId, ws);
      console.log(blue(`WebSocket global client connected: ${bold(globalId)}`));

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "USER_RESPONSE" && message.jobId) {
            handleGlobalUserResponse(message as UIResponse);
          }
        } catch (e) {
          console.error(`Error processing message from global client ${globalId}:`, e);
        }
      });

      ws.on("close", () => {
        globalWsMap.delete(globalId);
        console.log(blue(`WebSocket global client disconnected: ${bold(globalId)}`));
      });

      ws.on("error", (error) => console.error(`WebSocket error for global client ${globalId}:`, error));
      ws.send(JSON.stringify({type: "GLOBAL_WELCOME", globalId}));
    }
  });

  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
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
