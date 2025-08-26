import {blue, bold} from "@gaubee/nodekit";
import type {UIRenderCommand, UIResponse} from "@jixo/tools-uikit";

const wsMap = new Map<string, WebSocket>();
let sessionIdCounter = 0;

// --- Render Service ---
// This service manages the lifecycle of a UI render job.
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

/**
 * The concrete implementation of the RenderHandler.
 * It sends a RENDER_UI command via WebSocket and waits for a USER_RESPONSE.
 */
export const webSocketRenderHandler = (sessionId: string, command: UIRenderCommand): Promise<any> => {
  const ws = wsMap.get(sessionId);
  if (!ws) {
    return Promise.reject(new Error(`No active WebSocket session found for ID: ${sessionId}`));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        jobListeners.delete(command.jobId);
        reject(new Error(`UI render job ${command.jobId} timed out after 5 minutes.`));
      },
      5 * 60 * 1000,
    ); // 5 minute timeout

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
function handleSocket(socket: WebSocket): string {
  const sessionId = `session-${sessionIdCounter++}`;
  wsMap.set(sessionId, socket);
  console.log(blue(`WebSocket client connected: ${bold(sessionId)}`));

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "USER_RESPONSE" && message.jobId) {
        handleUserResponse(message as UIResponse);
      } else {
        console.log(`Received unhandled message from ${sessionId}:`, message);
      }
    } catch (e) {
      console.error(`Error processing message from ${sessionId}:`, e);
    }
  };

  socket.onclose = () => {
    wsMap.delete(sessionId);
    // Clean up any pending jobs for this session
    // (This is a simplified cleanup)
    jobListeners.forEach((_, jobId) => {
      // A more robust implementation would associate jobs with sessions
    });
    console.log(blue(`WebSocket client disconnected: ${bold(sessionId)}`));
  };

  socket.onerror = (error) => {
    console.error(`WebSocket error for ${sessionId}:`, error);
  };

  socket.send(JSON.stringify({type: "WELCOME", sessionId}));

  return sessionId;
}

export async function startWsServer(port = 8765) {
  console.log(blue(`Starting WebSocket server on port ${bold(port.toString())}...`));

  try {
    Deno.serve({port, hostname: "127.0.0.1"}, (req) => {
      if (req.headers.get("upgrade") !== "websocket") {
        return new Response("Not a websocket request", {status: 400});
      }
      const {socket, response} = Deno.upgradeWebSocket(req);
      handleSocket(socket);
      return response;
    });
  } catch (error) {
    if (error instanceof Deno.errors.AddrInUse) {
      console.warn(`Port ${port} is already in use. Assuming server is running in another process.`);
    } else {
      throw error;
    }
  }
}
