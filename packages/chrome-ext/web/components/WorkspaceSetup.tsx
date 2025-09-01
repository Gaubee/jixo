import React, {useState} from "react";

// In the new model, this component will call a function passed via props
// which is connected to the content-script's API.
interface WorkspaceSetupProps {
  onWorkspaceSelected: (workspaceName: string) => void;
  selectWorkspace: () => Promise<string | null>;
}

export function WorkspaceSetup({onWorkspaceSelected, selectWorkspace}: WorkspaceSetupProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectWorkspace = async () => {
    setIsSelecting(true);
    setError(null);
    try {
      const workspaceName = await selectWorkspace();
      if (workspaceName) {
        onWorkspaceSelected(workspaceName);
      }
    } catch (err) {
      console.error("Error in handleSelectWorkspace:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 text-center">
      <h1 className="text-lg font-bold">Welcome to JIXO</h1>
      <p className="text-sm text-gray-600">To get started, please select a local folder to use as your workspace.</p>
      <button onClick={handleSelectWorkspace} className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400" disabled={isSelecting}>
        {isSelecting ? "Waiting for selection..." : "Select Workspace Folder"}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
