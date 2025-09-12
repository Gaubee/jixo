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
  return <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-2 font-mono text-xs">{lines}</pre>;
};

interface SubmitChangeSetPanelProps {
  props: {
    change_log: string;
    operations: Array<{
      type: "writeFile" | "deleteFile" | "renameFile";
      path: string;
      content?: string;
      new_path?: string;
    }>;
  };
  resolvers: PromiseWithResolvers<{approved: boolean; reason?: string}>;
}

export function SubmitChangeSetPanel({props, resolvers}: SubmitChangeSetPanelProps) {
  const {change_log, operations} = props;

  const handleResponse = (approved: boolean) => {
    resolvers.resolve({
      approved,
      reason: approved ? undefined : "Changeset was rejected by the user.",
    });
  };

  const renderOperation = (op: (typeof operations)[0], index: number) => {
    switch (op.type) {
      case "writeFile":
        return (
          <div key={index} className="mt-2 border-t pt-2">
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
      <div className="space-y-3 rounded-md border bg-gray-50 p-3">
        <p className="font-semibold text-gray-700">Commit Message:</p>
        <pre className="whitespace-pre-wrap rounded border bg-white p-2">{change_log}</pre>
      </div>
      <div className="space-y-2 rounded-md border bg-gray-50 p-3">
        <p className="font-semibold text-gray-700">File Operations:</p>
        {operations.map(renderOperation)}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => handleResponse(false)} className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
          Cancel
        </button>
        <button onClick={() => handleResponse(true)} className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600">
          Apply Changes
        </button>
      </div>
    </div>
  );
}
