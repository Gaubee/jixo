import {z} from "zod/v4-mini";
import {zEvalTask} from "./eval.js";
import {zFetchTask} from "./fetch.js";

export const zModels = z.object({
  object: z.string(),
  data: z.array(
    z.object({
      id: z.string(),
      object: z.string(),
      created: z.number(),
      owned_by: z.string(),
      active: z.boolean(),
      context_window: z.number(),
      public_apps: z.null(),
      max_completion_tokens: z.number(),
      features: z.object({
        chat: z.boolean(),
        tools: z.boolean(),
        json_mode: z.boolean(),
        max_input_images: z.number(),
        transcription: z.boolean(),
        audio_translation: z.boolean(),
        is_batch_enabled: z.boolean(),
      }),
      metadata: z.looseObject({
        display_name: z.string(),
      }),
      terms_url: z.nullable(z.string()),
      is_terms_required: z.boolean(),
      is_terms_accepted: z.nullable(z.boolean()),
    }),
  ),
});

export const zSession = z.object({
  time: z.number(),
  headers: z.record(z.string(), z.string()),
  models: zModels.shape.data,
});
export type Session = z.infer<typeof zSession>;

export const zTask = z.union([z.lazy(() => zEvalTask), z.lazy(() => zFetchTask)]);

export type Task = z.output<typeof zTask>;
