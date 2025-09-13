import {FormDescription, FormLabel} from "@/components/ui/form.tsx";
import {Switch} from "@/components/ui/switch.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import React from "react";
import {useController, type Control} from "react-hook-form";
import type {AgentForm} from "../hooks/useConfigPanelState.ts";

export interface ToolsSwithListProps {
  control: Control<AgentForm>;
  tools: Array<{name: string; filepath: string; description: string}>;
}

export function ToolsSwitchList({control, tools}: ToolsSwithListProps) {
  const {field} = useController({
    control,
    name: "metadata.tools.exclude",
    defaultValue: [],
  });

  const excludedTools = new Set(field.value || []);

  const handleCheckedChange = (checked: boolean, toolName: string) => {
    const newExcluded = new Set(excludedTools);
    if (checked) {
      newExcluded.delete(toolName);
    } else {
      newExcluded.add(toolName);
    }
    field.onChange(Array.from(newExcluded));
  };

  return (
    <div className="space-y-2">
      <FormLabel>Available Tools</FormLabel>
      {tools.length === 0 ? (
        <FormDescription>No tools available.</FormDescription>
      ) : (
        <div className="max-h-32 space-y-2 overflow-y-auto rounded-md border p-2 pr-3">
          {tools.map((tool) => (
            <TooltipProvider key={tool.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between">
                    <label htmlFor={`tool-switch-${tool.name}`} className="text-sm font-medium">
                      {tool.name}
                    </label>
                    <Switch id={`tool-switch-${tool.name}`} checked={!excludedTools.has(tool.name)} onCheckedChange={(checked) => handleCheckedChange(checked, tool.name)} />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="flex flex-col items-start gap-1.5">
                  <p className="inline-block rounded-lg bg-[color-mix(in_srgb,var(--background)_20%,transparent)] px-1 py-0.5 font-mono text-xs italic">{tool.filepath}</p>
                  <p className="font-mono text-xs">{tool.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      )}
    </div>
  );
}
