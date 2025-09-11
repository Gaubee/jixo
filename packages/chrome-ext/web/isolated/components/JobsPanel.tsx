import React, {useContext} from "react";
import {ErrorBoundary} from "react-error-boundary";
import {match} from "ts-pattern";
import {AskUserDialog} from "./AskUserDialog";
import {FunctionCallRenderJobsCtx, type FunctionCallRenderJob} from "./context";
import {LogThoughtPanel} from "./LogThoughtPanel";
import {ProposePlanDialog} from "./ProposePlanDialog";
import {SubmitChangeSetPanel} from "./SubmitChangeSetPanel";

export function JobsPanel() {
  const jobs = useContext(FunctionCallRenderJobsCtx);
  return (
    <div className="grid grid-cols-1 gap-4">
      {jobs.map((job) => (
        <JobRender job={job} />
      ))}
    </div>
  );
}

function JobRender({job}: {job: FunctionCallRenderJob}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="text-red-500">
          Error:
          <pre>
            <code>{JSON.stringify(job, null, 2)}</code>
          </pre>
        </div>
      }
    >
      {match(job.componentName)
        .with("AskUserDialog", () => <AskUserDialog {...job} />)
        .with("LogThoughtPanel", () => <LogThoughtPanel {...job} />)
        .with("ProposePlanDialog", () => <ProposePlanDialog {...job} />)
        .with("SubmitChangeSetPanel", () => <SubmitChangeSetPanel {...job} />)
        .otherwise(() => {
          return <p>Error: Unknown component '{job.componentName}'</p>;
        })}
    </ErrorBoundary>
  );
}
