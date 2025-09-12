import type {BackgroundAPI} from "./comlink.ts";

export const WS_PORT = 8765;

class GlobalWebSocket extends EventTarget {
  private socket: WebSocket | null = null;
  private status: "connecting" | "connected" | "disconnected" = "disconnected";
  private backgroundAPI: BackgroundAPI | null = null;

  constructor() {
    super();
  }

  public initialize(api: BackgroundAPI) {
    this.backgroundAPI = api;
    this.connect();
  }

  public getStatus() {
    return this.status;
  }

  private setStatus(newStatus: typeof this.status) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.dispatchEvent(new CustomEvent("statuschange", {detail: this.status}));
    }
  }

  private connect() {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      return;
    }
    this.setStatus("connecting");
    console.log("JIXO BG: Attempting to connect to global WebSocket...");

    this.socket = new WebSocket(`ws://127.0.0.1:${WS_PORT}/`);

    this.socket.onopen = () => {
      console.log("JIXO BG: Global WebSocket connection established.");
      this.setStatus("connected");
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("JIXO BG: Received WebSocket message from server:", message);

        // UI render jobs are now handled directly by the session WebSocket.
        // This global socket is only for status and generic events.
      } catch (error) {
        console.error("JIXO BG: Failed to parse WebSocket message:", event.data, error);
      }
    };

    this.socket.onclose = () => {
      console.log("JIXO BG: Global WebSocket connection closed. Reconnecting in 5s...");
      this.socket = null;
      this.setStatus("disconnected");
      setTimeout(() => this.connect(), 5000);
    };

    this.socket.onerror = (error) => {
      console.error(`JIXO BG: Global WebSocket error:`, error);
      // onclose will be called next, triggering reconnect logic.
    };
  }
}

export const globalWebSocket = new GlobalWebSocket();

export const createSessionWebSocket = (sessionId: string, port: chrome.runtime.Port) => {
  const ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}/session/${sessionId}`);
  ws.addEventListener("open", () => {
    port.postMessage({type: "open"});
  });
  ws.addEventListener("message", (event) => {
    port.postMessage({type: "message", data: event.data});
  });
  ws.addEventListener("error", () => {
    port.postMessage({type: "error"});
  });
  ws.addEventListener("close", () => {
    try {
      port.postMessage({type: "close"});
    } catch {}
    port.disconnect();
  });

  port.onMessage.addListener((msg) => {
    ws.send(msg);
  });
  port.onDisconnect.addListener(() => {
    queueMicrotask(() => {
      ws.close();
    });
  });
};
