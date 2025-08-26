// This script runs in the context of the side panel.
console.log("JIXO AI Tools side panel script loaded.");

const root = document.getElementById("root");

function setStatus(message: string) {
  if (root) {
    root.innerHTML = `<h1>JIXO AI Tools</h1><p>${message}</p>`;
  }
}

function renderAskUserDialog(jobId: string, props: any) {
  if (!root) return;

  const {question, options} = props;

  let inputHtml = options
    ? `<select id="user-response">${options.map((opt: string) => `<option value="${opt}">${opt}</option>`).join("")}</select>`
    : `<input id="user-response" type="text" placeholder="Enter your response..."/>`;

  root.innerHTML = `
        <div class="dialog">
            <h3>${question}</h3>
            ${inputHtml}
            <div class="buttons">
                <button id="submit-btn">Submit</button>
                <button id="cancel-btn">Cancel</button>
            </div>
        </div>
    `;

  document.getElementById("submit-btn")?.addEventListener("click", () => {
    const inputEl = document.getElementById("user-response") as HTMLInputElement | HTMLSelectElement;
    const response = inputEl.value;
    chrome.runtime.sendMessage({
      type: "USER_RESPONSE",
      jobId,
      payload: {data: response},
    });
    setStatus("Response sent. Waiting for next command...");
  });

  document.getElementById("cancel-btn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "USER_RESPONSE",
      jobId,
      payload: {error: "User cancelled the operation."},
    });
    setStatus("Operation cancelled. Waiting for next command...");
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Side panel received message:", message);

  if (message.type === "WELCOME") {
    setStatus(`Connected. Session ID: ${message.sessionId}`);
  } else if (message.type === "RENDER_UI" && message.jobId && message.payload.component === "AskUserDialog") {
    renderAskUserDialog(message.jobId, message.payload.props);
  }

  sendResponse({status: "MESSAGE_RECEIVED"});
});

setStatus("Side panel is active. Attempting to connect...");

// JIXO_CODER_EOF
