import React from "react";

interface ProposePlanDialogProps {
  jobId: string;
  props: {
    plan_summary: string;
    steps: string[];
  };
}

export function ProposePlanDialog({jobId, props}: ProposePlanDialogProps) {
  const {plan_summary, steps} = props;

  const handleResponse = (approved: boolean) => {
    chrome.runtime.sendMessage({
      type: "USER_RESPONSE",
      jobId,
      payload: {data: approved},
    });
    window.close();
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-base font-semibold">Plan Approval Request</h3>
      <div className="p-3 bg-gray-50 border rounded-md space-y-2">
        <p>
          <strong>Summary:</strong> {plan_summary}
        </p>
        <ul className="list-disc list-inside text-sm text-gray-600">
          {steps.map((s: string, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => handleResponse(false)} className="p-2 bg-red-500 text-white rounded">
          Reject
        </button>
        <button onClick={() => handleResponse(true)} className="p-2 bg-green-500 text-white rounded">
          Approve
        </button>
      </div>
    </div>
  );
}
