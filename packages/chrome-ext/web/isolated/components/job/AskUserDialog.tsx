import React, {useState} from "react";

interface AskUserDialogProps {
  props: {
    question: string;
    options?: string[];
  };
  resolvers: PromiseWithResolvers<string>;
}

export function AskUserDialog({props, resolvers}: AskUserDialogProps) {
  const {question, options} = props;
  const [response, setResponse] = useState(options ? options[0] || "" : "");

  const handleSubmit = () => {
    resolvers.resolve(response);
  };

  const handleCancel = () => {
    resolvers.reject("User cancelled the operation.");
  };

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-base font-semibold">{question}</h3>
      {options ? (
        <select value={response} onChange={(e) => setResponse(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm">
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
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm"
          placeholder="Enter your response..."
          autoFocus
        />
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={handleCancel} className="rounded bg-gray-200 px-4 py-2">
          Cancel
        </button>
        <button onClick={handleSubmit} className="rounded bg-blue-500 px-4 py-2 text-white">
          Submit
        </button>
      </div>
    </div>
  );
}
