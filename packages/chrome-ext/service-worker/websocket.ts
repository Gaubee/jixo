import type {BackgroundAPI} from "./comlink.ts";

let socket: WebSocket | null = null;
const WS_PORT = 8765;

function connect(backgroundAPI: BackgroundAPI | null) {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  socket = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);

  socket.onopen = () => console.log("JIXO BG: WebSocket connection established.");

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("JIXO BG: Received WebSocket message from server:", message);

      if (message.type === "RENDER_UI" && message.jobId && backgroundAPI) {
        backgroundAPI
          .renderComponentInActiveTab(message.payload.component, message.jobId, message.payload.props)
          .catch((err) => console.error("JIXO BG: Error relaying RENDER_UI to content script:", err));
      }
      // Other message types from the server can be handled here.
    } catch (error) {
      console.error("JIXO BG: Failed to parse WebSocket message:", event.data, error);
    }
  };

  socket.onclose = () => {
    console.log("JIXO BG: WebSocket connection closed. Reconnecting in 3s...");
    socket = null;
    setTimeout(() => connect(backgroundAPI), 3000);
  };

  socket.onerror = (error) => console.error(`JIXO BG: WebSocket error:`, error);
}

export function initializeWebSocket(backgroundAPI: BackgroundAPI | null) {
  connect(backgroundAPI);
  // Note: The logic for forwarding USER_RESPONSE from the extension *to* the server
  // is now implicitly handled by the content script's direct connection to background,
  // and background's connection to the node process via native messaging or another mechanism.
  // For our current WebSocket model, we need to add this back.
}
