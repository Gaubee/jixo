import React from "react";

const DiffViewer = ({content}: {content: string}) => {
  const lines = content.split("\n").map((line, i) => {
    let color = "text-gray-500";
    if (line.startsWith("+")) color = "text-green-600";
    if (line.startsWith("-")) color = "text-red-600";
    return (
      <div key={i} className={color}>
        {line || " "}
      </div>
    );
  });
  return <pre className="bg-gray-50 p-2 rounded-md text-xs whitespace-pre-wrap font-mono max-h-48 overflow-auto">{lines}</pre>;
};

interface SubmitChangeSetPanelProps {
  jobId: string; // jobId is always a string for interactive components
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
    window.dispatchEvent(
      new CustomEvent("jixo-user-response", {
        detail: {jobId, payload: {data: approved}},
      }),
    );
  };

  const renderOperation = (op: (typeof operations)[0], index: number) => {
    switch (op.type) {
      case "writeFile":
        return (
          <div key={index} className="border-t pt-2 mt-2">
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
    <div className="space-y-4 text-sm">
      <div className="p-3 bg-gray-50 border rounded-md space-y-3">
        <p className="font-semibold text-gray-700">Commit Message:</p>
        <pre className="bg-white p-2 border rounded whitespace-pre-wrap">{change_log}</pre>
      </div>
      <div className="p-3 bg-gray-50 border rounded-md space-y-2">
        <p className="font-semibold text-gray-700">File Operations:</p>
        {operations.map(renderOperation)}
      </div>
      <div className="flex justify-end gap-2">
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
