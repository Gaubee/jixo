import React from "react";

interface LogThoughtPanelProps {
  props: {
    thought: string;
    step: number;
    total_steps: number;
    is_conclusive: boolean;
  };
}

export function LogThoughtPanel({props}: LogThoughtPanelProps) {
  const {thought, step, total_steps, is_conclusive} = props;
  return (
    <div className="p-4 space-y-2 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="font-semibold text-blue-800">
        🧠 Thought ({step}/{total_steps}){is_conclusive && <span className="ml-2 font-normal text-green-600">(Conclusive)</span>}
      </h3>
      <p className="text-gray-700">{thought}</p>
    </div>
  );
}
