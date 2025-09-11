import {Button} from "@/components/ui/button.tsx";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Form, FormControl, FormDescription, FormField, FormItem, FormLabel} from "@/components/ui/form.tsx";
import {Switch} from "@/components/ui/switch.tsx";
import {zodResolver} from "@hookform/resolvers/zod";
import React from "react";
import {useForm} from "react-hook-form";
import {ConfirmDialog} from "./ConfirmDialog.tsx";
import {zPanelSettings, type PanelSettings} from "./context.ts";

interface SettingsPanelProps {
  values: PanelSettings;
  onSubmit: (values: PanelSettings) => void;
  onClearHistory: () => Promise<void>;
}

export function SettingsPanel({values: initialValues, onSubmit, onClearHistory}: SettingsPanelProps) {
  const form = useForm<PanelSettings>({
    resolver: zodResolver(zPanelSettings),
    values: initialValues, // Use values to sync from parent
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Settings</CardTitle>
        <CardDescription>Manage global functionalities and user preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 divide-y">
        <Form {...form}>
          {/* The form tag is still useful for semantics and accessibility */}
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="isSyncEnabled"
              render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Enable Page Sync</FormLabel>
                    <FormDescription>Automatically sync page content to local files.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        // First, update the form state
                        field.onChange(checked);
                        // Then, programmatically submit the form
                        form.handleSubmit(onSubmit)();
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
        <div className="space-y-3 pt-4">
          <ConfirmDialog
            title="Are you absolutely sure?"
            description="This action cannot be undone. This will permanently clear the AI Studio page's chat history."
            onConfirm={onClearHistory}
            trigger={
              <Button className="w-full" variant="destructive">
                Clear Page History
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
