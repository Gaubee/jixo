import React from "react";

// A very basic diff viewer component.
// In a real application, a library like `diff2html` would be used.
const DiffViewer = ({content}: {content: string}) => {
  const lines = content.split("\n").map((line, i) => {
    let color = "text-gray-500";
    if (line.startsWith("+")) color = "text-green-600";
    if (line.startsWith("-")) color = "text-red-600";
    return (
      <div key={i} className={color}>
        {line || " "}
      </div>
    ); // Render empty lines correctly
  });
  return <pre className="bg-gray-50 p-2 rounded-md text-xs whitespace-pre-wrap font-mono">{lines}</pre>;
};

interface SubmitChangeSetPanelProps {
  jobId: string;
  props: {
    change_log: string;
    operations: Array<{
      type: "writeFile" | "deleteFile" | "renameFile";
      path: string;
      content?: string;
      new_path?: string;
    }>;
  };
}

export function SubmitChangeSetPanel({jobId, props}: SubmitChangeSetPanelProps) {
  const {change_log, operations} = props;

  const handleResponse = (approved: boolean) => {
    chrome.runtime.sendMessage({
      type: "USER_RESPONSE",
      jobId,
      payload: {data: approved},
    });
    window.close();
  };

  const renderOperation = (op: (typeof operations)[0], index: number) => {
    switch (op.type) {
      case "writeFile":
        return (
          <div key={index} className="border-b pb-2 mb-2">
            <p className="font-semibold text-blue-700">
              📝 Modify: <code>{op.path}</code>
            </p>
            <DiffViewer content={op.content || ""} />
          </div>
        );
      case "deleteFile":
        return (
          <div key={index}>
            <p className="font-semibold text-red-700">
              🔥 Delete: <code>{op.path}</code>
            </p>
          </div>
        );
      case "renameFile":
        return (
          <div key={index}>
            <p className="font-semibold text-purple-700">
              🚚 Rename: <code>{op.path}</code> to <code>{op.new_path}</code>
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 space-y-4 text-sm max-h-screen overflow-y-auto">
      <h3 className="text-base font-semibold text-gray-800">Apply Changes?</h3>

      <div className="p-3 bg-gray-50 border rounded-md space-y-3">
        <p className="font-semibold text-gray-700">Commit Message:</p>
        <pre className="bg-white p-2 border rounded whitespace-pre-wrap">{change_log}</pre>
      </div>

      <div className="p-3 bg-gray-50 border rounded-md space-y-3">
        <p className="font-semibold text-gray-700">File Operations:</p>
        {operations.map(renderOperation)}
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-white py-2">
        <button onClick={() => handleResponse(false)} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
          Cancel
        </button>
        <button onClick={() => handleResponse(true)} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          Apply Changes
        </button>
      </div>
    </div>
  );
}
