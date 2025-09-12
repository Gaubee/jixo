import {type SessionAPI} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import {webSocketEndpoint} from "@jixo/dev/comlink-adapters";
import {match, P} from "ts-pattern";
import {isolatedContentScriptAPI} from "./content-script-api.tsx";

export const WS_PORT = 8765;

export const connectSessionApi = async (sessionId: string) => {
  const job = Promise.withResolvers<Comlink.Remote<SessionAPI>>();

  class PortSocket extends EventTarget {
    #readyState: number = WebSocket.CONNECTING;
    #port;
    get readyState() {
      return this.#readyState;
    }
    constructor(sessionId: string) {
      super();
      const port = chrome.runtime.connect({name: `ws-session:${sessionId}`});
      this.#port = port;
      port.onDisconnect.addListener(() => {
        this.#willClose();
      });
      port.onMessage.addListener((msg) => {
        match(msg)
          .with({type: "open"}, () => {
            if (this.#readyState === WebSocket.CONNECTING) {
              this.#readyState = WebSocket.OPEN;
              this.dispatchEvent(new Event("open"));
            }
          })
          .with({type: "message", data: P.select()}, (data) => {
            this.dispatchEvent(new MessageEvent("message", {data}));
          })
          .with({type: "error"}, () => {
            this.dispatchEvent(new ErrorEvent("error"));
          })
          .with({type: "close"}, () => {
            this.#willClose();
          });
      });
    }
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      this.#port.postMessage(data);
    }
    close() {
      if (this.#readyState >= WebSocket.CLOSING) {
        return;
      }
      this.#readyState = WebSocket.CLOSING;
      this.#port.disconnect();
    }
    #willClose() {
      if (this.#readyState !== WebSocket.CLOSED) {
        this.#readyState = WebSocket.CLOSED;
        this.dispatchEvent(new Event("close"));
        this.#port.disconnect();
      }
    }
  }

  const newSocket = new PortSocket(sessionId) as unknown as WebSocket;

  newSocket.addEventListener("open", async () => {
    console.log(`JIXO ISOLATED: Session WebSocket connected for ${sessionId}.`);
    const sessionApiEp = webSocketEndpoint({webSocket: newSocket, messageChannel: "session-" + sessionId});
    const uiApiEp = webSocketEndpoint({webSocket: newSocket, messageChannel: "ui-" + sessionId});
    const sessionApi = Comlink.wrap<SessionAPI>(sessionApiEp);

    // Export our local UI API implementation
    Comlink.expose(isolatedContentScriptAPI, uiApiEp);
    console.log("JIXO ISOLATED: UI API proxy sent to backend.");

    job.resolve(sessionApi);
  });

  newSocket.addEventListener("message", (event) => {
    try {
      // General message handling can be added here if needed, but RPC is handled by Comlink.
      const message = JSON.parse(event.data);
      console.log("JIXO ISOLATED: Received raw message (should be rare):", message);
    } catch (error) {
      // This might be a Comlink message, which is fine.
    }
  });

  newSocket.addEventListener("close", () => {
    console.log("JIXO ISOLATED: Session WebSocket closed.");
    job.reject(new Error("WebSocket connection closed during initialization."));
  });

  newSocket.addEventListener("error", (error) => {
    console.error(`JIXO ISOLATED: Session WebSocket error:`, error);
    job.reject(error);
  });

  const sessionApi = await job.promise;

  const destroySessionApi = () => {
    newSocket.close();
  };

  return {
    sessionApi,
    destroySessionApi,
  };
};
