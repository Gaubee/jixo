// This is the background service worker for the Chrome extension.
console.log("JIXO BG: Script start.");

let socket: WebSocket | null = null;
let sessionId: string | null = null;

// --- State Management ---
interface ConnectionState {
  status: "connected" | "disconnected" | "connecting";
  serverUri: string;
  sessionId: string | null;
}

const state: ConnectionState = {
  status: "disconnected",
  serverUri: "ws://127.0.0.1:8765",
  sessionId: null,
};

function updateState(newState: Partial<ConnectionState>) {
  console.log("JIXO BG: Updating state", newState);
  Object.assign(state, newState);
  broadcastState();
}

function broadcastState() {
  console.log("JIXO BG: Broadcasting state", state);
  chrome.runtime.sendMessage({type: "STATE_UPDATE", payload: state});
}

// --- WebSocket Logic ---
function connectWebSocket(uri?: string) {
  if (uri) {
    state.serverUri = uri;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log(`JIXO BG: Attempting to connect to ${state.serverUri}...`);
  updateState({status: "connecting"});
  socket = new WebSocket(state.serverUri);

  socket.onopen = () => console.log("JIXO BG: WebSocket connection established.");

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("JIXO BG: Received message from server:", message);

      if (message.type === "WELCOME") {
        sessionId = message.sessionId;
        updateState({status: "connected", sessionId: message.sessionId});
      } else if (message.type === "RENDER_UI" && message.jobId) {
        console.log("JIXO BG: RENDER_UI command received. Creating popup...");
        const url = new URL(chrome.runtime.getURL("popup.html"));
        url.searchParams.set("jobId", message.jobId);
        url.searchParams.set("payload", JSON.stringify(message.payload));

        chrome.windows.create({
          url: url.href,
          type: "popup",
          width: 400,
          height: 350,
        });
      }
    } catch (error) {
      console.error("JIXO BG: Failed to parse message:", event.data, error);
    }
  };

  socket.onclose = () => {
    console.log("JIXO BG: WebSocket connection closed. Reconnecting in 3s...");
    socket = null;
    sessionId = null;
    updateState({status: "disconnected", sessionId: null});
    setTimeout(() => connectWebSocket(), 3000);
  };

  socket.onerror = (error) => console.error(`JIXO BG: WebSocket error connecting to ${state.serverUri}:`, error);
}

connectWebSocket();

// --- Message Handling from Popups/Other Scripts ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("JIXO BG: Received message from a popup/script", message);
  if (message.type === "GET_STATUS") {
    sendResponse(state);
  } else if (message.type === "CONNECT") {
    connectWebSocket(message.payload.uri);
    sendResponse({status: "CONNECTION_ATTEMPTED"});
  } else if (message.type === "DEBUG_RENDER_UI") {
    // Handle debug message from ControlPanel
    const url = new URL(chrome.runtime.getURL("popup.html"));
    url.searchParams.set("jobId", "debug-job-id");
    url.searchParams.set("payload", JSON.stringify(message.payload));
    chrome.windows.create({url: url.href, type: "popup", width: 400, height: 350});
    sendResponse({status: "DEBUG_POPUP_CREATED"});
  } else if (message.type === "USER_RESPONSE") {
    if (socket && socket.readyState === WebSocket.OPEN && sessionId) {
      const messageWithSession = {...message, sessionId};
      socket.send(JSON.stringify(messageWithSession));
      sendResponse({status: "MESSAGE_SENT"});
    } else {
      sendResponse({status: "ERROR", reason: "WebSocket not connected"});
    }
  }
  return true;
});

// --- Extension Lifecycle/UI Events ---
chrome.runtime.onInstalled.addListener(() => {
  console.log("JIXO BG: Extension installed.");
  // Context menu is kept for potential future use, but doesn't create a window anymore.
  chrome.contextMenus.create({
    id: "jixoContextMenu",
    title: "JIXO AI Tools",
    contexts: ["all"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("JIXO BG: Context menu clicked.", {info, tab});
  // You can add other functionalities here later.
});

console.log("JIXO BG: Script end. Event listeners are active.");
