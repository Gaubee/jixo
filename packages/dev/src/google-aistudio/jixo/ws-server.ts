import {blue, bold} from "@gaubee/nodekit";
import {map_get_or_put} from "@gaubee/util";
import {Comlink} from "@jixo/dev/comlink";
import http from "node:http";
import {URL} from "node:url";
import {WebSocket, WebSocketServer} from "ws";
import {webSocketEndpoint} from "../../lib/comlink-adapters/web-socket-adapters.js";
import {SessionAPI, type UIApi} from "./SessionAPI.js";
export type {SessionAPI, UIApi};

export const globalWsMap = new Map<string, WebSocket>();
const sessionWsMap = new Map<
  string,
  {
    instances: Map<WebSocket, Comlink.Endpoint>;
    api: SessionAPI;
  }
>();
let globalSessionIdCounter = 0;

const getNid = () => {
  const nids = new Set(Array.from({length: sessionWsMap.size + 1}, (_, i) => i + 1));
  for (const session of sessionWsMap.values()) {
    nids.delete(session.api.nid);
  }
  return nids.values().next().value!;
};

// --- WebSocket Server ---
export function startWsServer(port = 8765) {
  const server = http.createServer();
  const wss = new WebSocketServer({noServer: true});

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url || "/", `ws://${request.headers.host ?? "localhost:8080"}`);
    const sessionIdMatch = url.pathname.match(/^\/session\/([^/]+)/);

    if (sessionIdMatch) {
      // Session-specific connection
      const sessionId = sessionIdMatch[1];
      const sessionApiEp = webSocketEndpoint({webSocket: ws, messageChannel: "session-" + sessionId});
      const nid = getNid();

      const session = map_get_or_put(sessionWsMap, sessionId, () => {
        const uiApiEp = webSocketEndpoint({webSocket: ws, messageChannel: "ui-" + sessionId});
        const uiApi = Comlink.wrap<UIApi>(uiApiEp);
        ws.on("close", () => {
          uiApi[Comlink.releaseProxy]();
        });

        const sessionApi = new SessionAPI(nid, sessionId, uiApi);
        Comlink.expose(sessionApi, sessionApiEp);

        return {instances: new Map(), api: sessionApi};
      });

      session.instances.set(ws, sessionApiEp);
      console.log(blue(`WebSocket session client connected: ${bold(sessionId)}`));

      ws.on("close", () => {
        session.instances.delete(ws);
        if (session.instances.size === 0) {
          sessionWsMap.delete(sessionId);
        }
        console.log(blue(`WebSocket session client disconnected: ${bold(sessionId)}`));
      });

      ws.on("error", (error) => console.error(`WebSocket error for session ${sessionId}:`, error));
    } else {
      // Global connection (from background script)
      const globalId = `global-${globalSessionIdCounter++}`;
      globalWsMap.set(globalId, ws);
      console.log(blue(`WebSocket global client connected: ${bold(globalId)}`));

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log("global message", message);
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

  server.on("request", (req, res) => {
    if (req.url?.startsWith("/init-session")) {
      return initSession(req, res);
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

const initSession = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const url = new URL(`http://${process.env.HOST ?? "localhost"}${req.url}`);
  const workDir = url.searchParams.get("workDir");
  if (!workDir) {
    return res.writeHead(400).end("workDir is required");
  }
  const nid = url.searchParams.get("nid");

  const sessionId = url.searchParams.get("sessionId") ?? getSessionByNid(nid)?.api.sessionId;
  if (!sessionId) {
    return res.writeHead(400).end("sessionId is required");
  }

  const session = sessionWsMap.get(sessionId);
  if (!session) {
    return res.writeHead(400).end("session not found");
  }
  session.api.setWorkDir(workDir);
  return res.writeHead(200).end();
};

const getSessionByNid = (nid?: number | string | null) => {
  if (nid == null) {
    return;
  }
  if (typeof nid === "string") {
    nid = parseInt(nid);
  }
  for (const session of sessionWsMap.values()) {
    if (session.api.nid === nid) {
      return session;
    }
  }
};
