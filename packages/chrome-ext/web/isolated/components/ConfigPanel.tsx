import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Form, FormControl, FormField, FormItem, FormLabel} from "@/components/ui/form.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import type {AgentMetadata, CoderAgentMetadata} from "@jixo/dev/browser";
import {zodResolver} from "@hookform/resolvers/zod";
import {FolderSearch, LoaderCircle} from "lucide-react";
import React, {useEffect} from "react";
import {useForm, useWatch} from "react-hook-form";
import {z} from "zod";
import {CoderAgentConfigPanel} from "./CoderAgentConfigPanel.tsx";

const AgentFormSchema = z.object({
  metadata: z.object({
    workDir: z.string().min(1, "Workspace directory is required."),
    agent: z.literal("coder"),
    codeName: z.string().optional(),
    dirs: z.array(z.string()).optional(),
    docs: z.array(z.string()).optional(),
    mcp: z
      .array(
        z.object({
          command: z.string(),
          prefix: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export type AgentFormValues = z.infer<typeof AgentFormSchema>;

interface ConfigPanelProps {
  values: AgentFormValues;
  isDirty: boolean;
  isGenerating: boolean;
  isLoading: boolean;
  onValuesChange: (values: AgentFormValues) => void;
  onApplyChanges: () => Promise<void>;
  onCancelChanges: () => Promise<void>;
  onPreview: (patterns: string[]) => Promise<string[]>;
  onSelectWorkspace: () => Promise<void>;
}

export function ConfigPanel({values, isDirty, isGenerating, isLoading, onValuesChange, onApplyChanges, onCancelChanges, onPreview, onSelectWorkspace}: ConfigPanelProps) {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(AgentFormSchema),
    values,
  });

  const watchedValues = useWatch({control: form.control});
  useEffect(() => {
    // Only notify parent if the form is considered dirty by react-hook-form
    if (form.formState.isDirty) {
      onValuesChange({metadata: watchedValues.metadata as AgentMetadata});
    }
  }, [watchedValues, onValuesChange, form.formState.isDirty]);

  // Sync parent state back to form when it changes (e.g., after cancel or external update)
  useEffect(() => {
    form.reset(values);
  }, [values, form]);

  return (
    <Form {...form}>
      {/* We prevent default form submission; actions are handled by buttons */}
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
                    <Button type="button" onClick={onSelectWorkspace} variant="outline" className="w-full justify-start text-left font-mono">
                      <FolderSearch className="mr-2 h-4 w-4" />
                      <span className="truncate">{field.value || "Click to select..."}</span>
                    </Button>
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
            <div className="border-t pt-4">{watchedValues.metadata?.agent === "coder" && <CoderAgentConfigPanel control={form.control} onPreview={onPreview} />}</div>
          </CardContent>
          <CardFooter className="flex gap-2 border-t pt-6">
            <Button type="button" onClick={onCancelChanges} variant="outline" className="flex-1" disabled={!isDirty || isLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={onApplyChanges} className="flex-1" disabled={!isDirty || isLoading}>
              {isLoading ? "Applying..." : "Apply Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
