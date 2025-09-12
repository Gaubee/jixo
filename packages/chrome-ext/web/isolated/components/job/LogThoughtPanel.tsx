import React, {useEffect} from "react";

interface LogThoughtPanelProps {
  props: {
    thought: string;
    step: number;
    total_steps: number;
    is_conclusive: boolean;
  };
  resolvers: PromiseWithResolvers<void>;
}

export function LogThoughtPanel({props, resolvers}: LogThoughtPanelProps) {
  const {thought, step, total_steps, is_conclusive} = props;
  useEffect(() => {
    resolvers.resolve();
  }, []);
  return (
    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
      <h3 className="flex items-center justify-between font-semibold text-blue-800">
        <span>🧠 AI Thought Process</span>
        <span className="rounded bg-blue-100 px-2 py-1 font-mono text-xs">
          {step}/{total_steps}
        </span>
      </h3>
      <p className="whitespace-pre-wrap text-gray-800">{thought}</p>
      {is_conclusive && <p className="mt-2 border-t border-blue-200 pt-2 text-xs font-bold text-green-700">✓ Conclusive thought.</p>}
    </div>
  );
}
