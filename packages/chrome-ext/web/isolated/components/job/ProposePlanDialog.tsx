import React from "react";

interface ProposePlanDialogProps {
  props: {
    plan_summary: string;
    steps: string[];
    estimated_tool_calls?: string[];
  };
  resolvers: PromiseWithResolvers<{approved: boolean; reason?: string}>;
}

export function ProposePlanDialog({props, resolvers}: ProposePlanDialogProps) {
  const {plan_summary, steps, estimated_tool_calls} = props;

  const handleResponse = (approved: boolean) => {
    resolvers.resolve({
      approved,
      reason: approved ? undefined : "Plan was rejected by the user.",
    });
  };

  return (
    <div className="space-y-4 p-4 text-sm">
      <div className="space-y-3 rounded-md border bg-gray-50 p-3">
        <div>
          <p className="font-semibold text-gray-700">Summary:</p>
          <p className="mt-1">{plan_summary}</p>
        </div>
        <div>
          <p className="font-semibold text-gray-700">Steps:</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-gray-600">
            {steps.map((s: string, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        {estimated_tool_calls && (
          <div>
            <p className="font-semibold text-gray-700">Tools to be used:</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {estimated_tool_calls.map((tool) => (
                <span key={tool} className="rounded-full bg-indigo-100 px-2 py-1 font-mono text-xs text-indigo-800">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => handleResponse(false)} className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600">
          Reject
        </button>
        <button onClick={() => handleResponse(true)} className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600">
          Approve
        </button>
      </div>
    </div>
  );
}
