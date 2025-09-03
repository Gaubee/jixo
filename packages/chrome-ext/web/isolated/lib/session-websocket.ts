import {getTargetNamespace} from "@jixo/dev/browser";

let socket: WebSocket | null = null;
const WS_PORT = 8765;
const pendingRequests = new Map<string, {resolve: (value: any) => void; reject: (reason?: any) => void}>();

function ensureConnection(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return resolve(socket);
    }
    if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.addEventListener("open", () => socket && resolve(socket), {once: true});
      socket.addEventListener("error", (err) => reject(err), {once: true});
      return;
    }

    const sessionId = getTargetNamespace();
    const newSocket = new WebSocket(`ws://127.0.0.1:${WS_PORT}/session/${sessionId}`);

    newSocket.onopen = () => {
      console.log(`JIXO ISOLATED: Session WebSocket connected for ${sessionId}.`);
      socket = newSocket;
      resolve(newSocket);
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
      socket = null;
      // Reject all pending requests on close
      for (const [requestId, promise] of pendingRequests.entries()) {
        promise.reject(new Error("WebSocket connection closed."));
        pendingRequests.delete(requestId);
      }
    };

    newSocket.onerror = (error) => {
      console.error(`JIXO ISOLATED: Session WebSocket error:`, error);
      reject(error);
    };
  });
}

/**
 * Sends a request to the session-specific WebSocket server and awaits a response.
 * @param type - The type of the request (e.g., "generateConfigFromMetadata").
 * @param payload - The data to send with the request.
 * @returns A promise that resolves with the payload of the server's response.
 */
export async function request<T = any>(type: string, payload: any): Promise<T> {
  const ws = await ensureConnection();
  const requestId = `req-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, {resolve, reject});
    ws.send(
      JSON.stringify({
        type: "REQUEST",
        requestId,
        payload,
      }),
    );
  });
}
