import React, {useContext} from "react";
import {ErrorBoundary} from "react-error-boundary";
import {match} from "ts-pattern";
import {FunctionCallRenderJobsCtx, type FunctionCallRenderJob} from "./context";
import {AskUserDialog} from "./job/AskUserDialog";
import {LogThoughtPanel} from "./job/LogThoughtPanel";
import {ProposePlanDialog} from "./job/ProposePlanDialog";
import {SubmitChangeSetPanel} from "./job/SubmitChangeSetPanel";

interface JobsPanelProps {}

export function JobsPanel({}: JobsPanelProps) {
  const jobs = useContext(FunctionCallRenderJobsCtx);
  return (
    <div className="grid grid-cols-1 gap-4">
      {[...jobs].map(([key, job]) => (
        <JobRender key={key} job={job} />
      ))}
    </div>
  );
}

interface JobRenderProps {
  job: FunctionCallRenderJob;
}

function JobRender({job}: JobRenderProps) {
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
