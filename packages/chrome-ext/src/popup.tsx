import React from "react";
import {createRoot} from "react-dom/client";
import {App} from "./App.tsx";
import {AskUserDialog} from "./components/AskUserDialog.tsx";
import {LogThoughtPanel} from "./components/LogThoughtPanel.tsx";
import {ProposePlanDialog} from "./components/ProposePlanDialog.tsx";
import {SubmitChangeSetPanel} from "./components/SubmitChangeSetPanel.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element not found in popup.html");
}
const root = createRoot(rootEl);

function Main() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get("jobId");
  const payloadStr = urlParams.get("payload");

  if (jobId && payloadStr) {
    try {
      const payload = JSON.parse(payloadStr);
      switch (payload.component) {
        case "AskUserDialog":
          return <AskUserDialog jobId={jobId} props={payload.props} />;
        case "LogThoughtPanel":
          return <LogThoughtPanel props={payload.props} />;
        case "ProposePlanDialog":
          return <ProposePlanDialog jobId={jobId} props={payload.props} />;
        case "SubmitChangeSetPanel":
          return <SubmitChangeSetPanel jobId={jobId} props={payload.props} />;
        default:
          return <p>Error: Unknown component '{payload.component}'.</p>;
      }
    } catch (e) {
      console.error("Failed to parse payload:", e);
      return <p>Error: Invalid payload data.</p>;
    }
  }

  return <App />;
}

root.render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
);
