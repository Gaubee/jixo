import React from "react";

interface ProposePlanDialogProps {
  jobId: string; // jobId is always a string for interactive components
  props: {
    plan_summary: string;
    steps: string[];
    estimated_tool_calls?: string[];
  };
}

export function ProposePlanDialog({jobId, props}: ProposePlanDialogProps) {
  const {plan_summary, steps, estimated_tool_calls} = props;

  const handleResponse = (approved: boolean) => {
    window.dispatchEvent(
      new CustomEvent("jixo-user-response", {
        detail: {jobId, payload: {data: approved}},
      }),
    );
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="p-3 bg-gray-50 border rounded-md space-y-3">
        <div>
          <p className="font-semibold text-gray-700">Summary:</p>
          <p className="mt-1">{plan_summary}</p>
        </div>
        <div>
          <p className="font-semibold text-gray-700">Steps:</p>
          <ul className="list-disc list-inside mt-1 space-y-1 text-gray-600">
            {steps.map((s: string, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        {estimated_tool_calls && (
          <div>
            <p className="font-semibold text-gray-700">Tools to be used:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {estimated_tool_calls.map((tool) => (
                <span key={tool} className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-mono rounded-full">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => handleResponse(false)} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
          Reject
        </button>
        <button onClick={() => handleResponse(true)} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          Approve
        </button>
      </div>
    </div>
  );
}
