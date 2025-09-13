import {Button} from "@/components/ui/button.tsx";
import {FormControl, FormField, FormItem, FormLabel} from "@/components/ui/form.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {X} from "lucide-react";
import React from "react";
import {useFieldArray} from "react-hook-form";
import {FileListInput} from "./FileListInput.tsx";
import {ToolsSwitchList, type ToolsSwithListProps} from "./ToolsSwitchList.tsx";

interface CoderAgentConfigPanelProps extends ToolsSwithListProps {
  onPreview: (patterns: string[]) => Promise<string[]>;
}
export function CoderAgentConfigPanel({control, tools, onPreview}: CoderAgentConfigPanelProps) {
  const {fields, append, remove} = useFieldArray({
    control,
    name: "metadata.mcp",
  });

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="metadata.codeName"
        render={({field}) => (
          <FormItem>
            <FormLabel>Task Codename (codeName)</FormLabel>
            <FormControl>
              <Input {...field} placeholder="e.g., feature-x-refactor" />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="metadata.dirs"
        render={({field}) => (
          <FormItem>
            <FormControl>
              <FileListInput
                label="Directories (dirs)"
                values={field.value || []}
                onChange={field.onChange}
                onBlur={field.onBlur}
                onPreview={onPreview}
                placeholder="e.g., src/**/*.ts"
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="metadata.docs"
        render={({field}) => (
          <FormItem>
            <FormControl>
              <FileListInput
                label="Documentation (docs)"
                values={field.value || []}
                onChange={field.onChange}
                onBlur={field.onBlur}
                onPreview={onPreview}
                placeholder="e.g., docs/architecture.md"
              />
            </FormControl>
          </FormItem>
        )}
      />
      <ToolsSwitchList control={control} tools={tools} />
      <div className="space-y-2">
        <FormLabel>MCP Tools</FormLabel>
        <div className="max-h-32 space-y-2 overflow-y-auto pr-2">
          {fields.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <FormField
                control={control}
                name={`metadata.mcp.${index}.command`}
                render={({field}) => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <Input {...field} placeholder="MCP command" className="h-8 text-xs" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <FormField
                      control={control}
                      name={`metadata.mcp.${index}.prefix`}
                      render={({field}) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Prefix" className="h-8 w-24 text-xs" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Optional prefix to avoid tool name collisions.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => remove(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => append({command: "", prefix: ""})} variant="secondary" size="sm">
            Add MCP Tool
          </Button>
        </div>
      </div>
    </div>
  );
}
