import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Form, FormControl, FormField, FormItem, FormLabel} from "@/components/ui/form.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {LoaderCircle} from "lucide-react";
import React from "react";
import {useWatch} from "react-hook-form";
import type {useConfigPanelState} from "../hooks/useConfigPanelState.ts";
import {CoderAgentConfigPanel} from "./CoderAgentConfigPanel.tsx";

type ConfigFormProps = ReturnType<typeof useConfigPanelState>;

export function ConfigForm({form, stagedConfig, isDirty, isGenerating, isLoading, handleApplyChanges, handleCancelChanges, handlePreview}: ConfigFormProps) {
  const watchedValues = useWatch({control: form.control});

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Agent Configuration</span>
              {isGenerating && <LoaderCircle className="text-muted-foreground size-4 animate-spin" />}
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
                    <div className="text-muted-foreground rounded-md border bg-gray-100 px-3 py-2 font-mono text-xs">{field.value}</div>
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
          <CardFooter className="flex gap-2 border-t pt-6">
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
