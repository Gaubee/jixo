import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Form, FormControl, FormField, FormItem, FormLabel} from "@/components/ui/form.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {FolderSearch, LoaderCircle} from "lucide-react";
import {AnimatePresence, motion} from "motion/react";
import React from "react";
import {useWatch} from "react-hook-form";
import type {ConfigPanelState} from "../hooks/useConfigPanelState.ts";
import {CoderAgentConfigPanel} from "./CoderAgentConfigPanel.tsx";

interface ConfigFormProps extends ConfigPanelState {}

export function ConfigForm({
  form,
  stagedConfig,
  isDirty,
  isGenerating,
  isLoading,
  isSelecting,
  handleApplyChanges,
  handleCancelChanges,
  handlePreview,
  handleSelectWorkspace,
}: ConfigFormProps) {
  const watchedValues = useWatch({control: form.control});

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <Card>
          <CardHeader>
            <CardTitle className="flex h-4 items-center gap-2">
              <span>Agent Configuration</span>
              <AnimatePresence>
                {isGenerating && (
                  <motion.div
                    key="loader" // 保证 React key 唯一，AnimatePresence 才能正确识别
                    initial={false} // 进入时立刻显示，无动画
                    exit={{opacity: 0, scale: 0.8, transition: {duration: 0.3}}}
                  >
                    <LoaderCircle className="text-muted-foreground size-4 animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="metadata.workDir"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Workspace (workDir)</FormLabel>
                  <FormControl>
                    <TooltipProvider key="workDir" delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            disabled={isSelecting}
                            onClick={handleSelectWorkspace}
                            variant="outline"
                            className="w-full items-start justify-between overflow-hidden text-left font-mono"
                          >
                            <span className="truncate">{field.value || "Click to select..."}</span>
                            <FolderSearch className="ml-2 h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono text-xs">{field.value}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metadata.agent"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Agent</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an agent" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="coder">Coder Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <div className="border-t pt-4">
              {watchedValues.metadata?.agent === "coder" && <CoderAgentConfigPanel control={form.control} tools={stagedConfig.tools} onPreview={handlePreview} />}
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 border-t border-[color-mix(in_srgb,currentColor,transparent_90%)] pt-6">
            <Button type="button" onClick={handleCancelChanges} variant="outline" className="flex-1" disabled={!isDirty || isLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleApplyChanges} className="flex-1" disabled={!isDirty || isLoading}>
              {isLoading ? "Applying..." : "Apply Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
