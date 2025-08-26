// This is the background service worker for the Chrome extension.
let socket: WebSocket | null = null;
let sessionId: string | null = null;
const WS_PORT = 8765;

function connectWebSocket() {
  // Prevent multiple connections
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log("WebSocket is already open or connecting.");
    return;
  }

  socket = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);

  socket.onopen = () => {
    console.log("WebSocket connection established.");
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received message from server:", message);

      if (message.type === "WELCOME") {
        sessionId = message.sessionId;
        console.log(`Assigned session ID: ${sessionId}`);
      }

      // Forward the message to the side panel
      chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error("Failed to parse message:", event.data, error);
    }
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed. Attempting to reconnect in 3 seconds...");
    socket = null;
    sessionId = null;
    setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    // The onclose event will fire next, triggering the reconnect logic.
  };
}

// Initial connection attempt
connectWebSocket();

// Listen for messages from the side panel (or other extension parts)
// and forward them to the WebSocket server.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (socket && socket.readyState === WebSocket.OPEN && sessionId) {
    const messageWithSession = {...message, sessionId};
    console.log("Sending message to server:", messageWithSession);
    socket.send(JSON.stringify(messageWithSession));
    sendResponse({status: "MESSAGE_SENT"});
  } else {
    console.error("WebSocket is not connected. Cannot send message.");
    sendResponse({status: "ERROR", reason: "WebSocket not connected"});
  }
  // Return true to indicate you wish to send a response asynchronously
  return true;
});

// On installation, set up the side panel to open automatically on AI Studio sites.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openSidePanel",
    title: "Open JIXO Panel",
    contexts: ["all"],
  });
});

// When the context menu item is clicked, open the side panel.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openSidePanel" && tab?.id) {
    chrome.sidePanel.open({tabId: tab.id});
  }
});

// When the browser action icon is clicked, toggle the side panel for the current tab.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({tabId: tab.id});
  }
});

console.log("JIXO AI Tools background service worker started.");

// JIXO_CODER_EOF
