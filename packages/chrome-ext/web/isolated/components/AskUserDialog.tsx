import React, {useState} from "react";

interface AskUserDialogProps {
  jobId: string; // jobId is always a string for interactive components
  props: {
    question: string;
    options?: string[];
  };
}

export function AskUserDialog({jobId, props}: AskUserDialogProps) {
  const {question, options} = props;
  const [response, setResponse] = useState(options ? options[0] || "" : "");

  const handleSubmit = () => {
    window.dispatchEvent(
      new CustomEvent("jixo-user-response", {
        detail: {jobId, payload: {data: response}},
      }),
    );
  };

  const handleCancel = () => {
    window.dispatchEvent(
      new CustomEvent("jixo-user-response", {
        detail: {jobId, payload: {error: "User cancelled the operation."}},
      }),
    );
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-base font-semibold">{question}</h3>
      {options ? (
        <select value={response} onChange={(e) => setResponse(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm">
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"
          placeholder="Enter your response..."
          autoFocus
        />
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={handleCancel} className="px-4 py-2 bg-gray-200 rounded">
          Cancel
        </button>
        <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded">
          Submit
        </button>
      </div>
    </div>
  );
}
