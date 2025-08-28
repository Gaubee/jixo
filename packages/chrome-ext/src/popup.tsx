import React from "react";
import ReactDOM from "react-dom/client";
import {ControlPanel} from "./components/ControlPanel.tsx";
import {AskUserDialog} from "./components/AskUserDialog.tsx";
import {LogThoughtPanel} from "./components/LogThoughtPanel.tsx";
import {ProposePlanDialog} from "./components/ProposePlanDialog.tsx";

console.log("JIXO POPUP: Script start.");

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("JIXO POPUP: Root element not found in popup.html");
}
const root = ReactDOM.createRoot(rootEl);

function App() {
  console.log("JIXO POPUP: App component rendering.");
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get("jobId");
  const payloadStr = urlParams.get("payload");

  if (jobId && payloadStr) {
    console.log(`JIXO POPUP: Rendering UI for job ID: ${jobId}`);
    try {
      const payload = JSON.parse(payloadStr);
      switch (payload.component) {
        case "AskUserDialog":
          return <AskUserDialog jobId={jobId} props={payload.props} />;
        case "LogThoughtPanel":
          return <LogThoughtPanel props={payload.props} />;
        case "ProposePlanDialog":
          return <ProposePlanDialog jobId={jobId} props={payload.props} />;
        default:
          return <p>Error: Unknown component '{payload.component}'.</p>;
      }
    } catch (e) {
      console.error("JIXO POPUP: Failed to parse payload:", e);
      return <p>Error: Invalid payload data.</p>;
    }
  }

  console.log("JIXO POPUP: No job ID found, rendering default Control Panel.");
  return <ControlPanel />;
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
