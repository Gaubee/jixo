import React, {useState} from "react";

interface AskUserDialogProps {
  jobId: string;
  props: {
    question: string;
    options?: string[];
  };
}

export function AskUserDialog({jobId, props}: AskUserDialogProps) {
  const {question, options} = props;
  const [response, setResponse] = useState(options ? options[0] : "");

  const handleSubmit = () => {
    chrome.runtime.sendMessage({
      type: "USER_RESPONSE",
      jobId,
      payload: {data: response},
    });
    window.close();
  };

  const handleCancel = () => {
    chrome.runtime.sendMessage({
      type: "USER_RESPONSE",
      jobId,
      payload: {error: "User cancelled the operation."},
    });
    window.close();
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
        />
      )}
      <div className="flex justify-end gap-2">
        <button onClick={handleCancel} className="p-2 bg-gray-200 rounded">
          Cancel
        </button>
        <button onClick={handleSubmit} className="p-2 bg-blue-500 text-white rounded">
          Submit
        </button>
      </div>
    </div>
  );
}
