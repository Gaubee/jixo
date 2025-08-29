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
    <div className="p-4 space-y-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
      <h3 className="font-semibold text-blue-800 flex justify-between items-center">
        <span>🧠 AI Thought Process</span>
        <span className="text-xs font-mono px-2 py-1 bg-blue-100 rounded">
          {step}/{total_steps}
        </span>
      </h3>
      <p className="text-gray-800 whitespace-pre-wrap">{thought}</p>
      {is_conclusive && <p className="text-xs text-green-700 font-bold pt-2 border-t border-blue-200 mt-2">✓ Conclusive thought. Ready for the next step.</p>}
    </div>
  );
}
