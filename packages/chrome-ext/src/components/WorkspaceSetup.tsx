// packages/chrome-ext/src/components/WorkspaceSetup.tsx
import React from "react";

interface WorkspaceSetupProps {
  onWorkspaceSelected: (handle: FileSystemDirectoryHandle) => void;
}

export function WorkspaceSetup({onWorkspaceSelected}: WorkspaceSetupProps) {
  const handleSelectWorkspace = async () => {
    try {
      const handle = await window.showDirectoryPicker({mode: "readwrite"});
      onWorkspaceSelected(handle);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("User cancelled directory selection.");
      } else {
        console.error("Error selecting directory:", error);
        // You could show an error message to the user here.
      }
    }
  };

  return (
    <div className="p-4 space-y-4 text-center">
      <h1 className="text-lg font-bold">Welcome to JIXO</h1>
      <p className="text-sm text-gray-600">
        To get started, please select a local folder to use as your workspace. This folder will store your chat history and tool configurations.
      </p>
      <button onClick={handleSelectWorkspace} className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Select Workspace Folder
      </button>
    </div>
  );
}
