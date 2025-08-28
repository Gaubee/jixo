// This script runs in the context of the popup window.
console.log("JIXO AI Tools popup script loaded.");

const root = document.getElementById("root");

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
    chrome.runtime.sendMessage({type: "USER_RESPONSE", jobId, payload: {data: inputEl.value}});
    window.close();
  });

  document.getElementById("cancel-btn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({type: "USER_RESPONSE", jobId, payload: {error: "User cancelled the operation."}});
    window.close();
  });
}

function renderLogThoughtPanel(props: any) {
  if (!root) return;
  const {thought, step, total_steps} = props;
  root.innerHTML = `
        <div class="dialog">
            <h3>🧠 Thought (${step}/${total_steps})</h3>
            <p>${thought}</p>
        </div>
    `;
  // This is a display-only panel, so it doesn't send a response.
  // We might want to add a close button later.
}

function renderProposePlanDialog(jobId: string, props: any) {
  if (!root) return;
  const {plan_summary, steps} = props;
  root.innerHTML = `
        <div class="dialog">
            <h3>Plan Approval Request</h3>
            <p><strong>Summary:</strong> ${plan_summary}</p>
            <ul>
                ${steps.map((s: string) => `<li>${s}</li>`).join("")}
            </ul>
            <div class="buttons">
                <button id="approve-btn">Approve</button>
                <button id="reject-btn">Reject</button>
            </div>
        </div>
    `;

  document.getElementById("approve-btn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({type: "USER_RESPONSE", jobId, payload: {data: true}});
    window.close();
  });

  document.getElementById("reject-btn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({type: "USER_RESPONSE", jobId, payload: {data: false}});
    window.close();
  });
}

// Main logic to initialize the popup
function initialize() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get("jobId");
  const payloadStr = urlParams.get("payload");

  if (!jobId || !payloadStr) {
    if (root) root.innerHTML = `<p>Error: No job ID/payload. This is a UI render popup.</p>`;
    return;
  }

  try {
    const payload = JSON.parse(payloadStr);
    switch (payload.component) {
      case "AskUserDialog":
        renderAskUserDialog(jobId, payload.props);
        break;
      case "LogThoughtPanel":
        // LogThought doesn't have a jobId for response, but we pass it anyway
        renderLogThoughtPanel(payload.props);
        break;
      case "ProposePlanDialog":
        renderProposePlanDialog(jobId, payload.props);
        break;
      default:
        if (root) root.innerHTML = `<p>Error: Unknown component '${payload.component}'.</p>`;
    }
  } catch (e) {
    if (root) root.innerHTML = `<p>Error: Invalid payload data.</p>`;
    console.error("Failed to parse payload:", e);
  }
}

initialize();
