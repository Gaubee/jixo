import type {SessionAPI} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import React from "react";
import {z} from "zod/v4-mini";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api.ts";
import type {IsolatedContentScriptAPI} from "../lib/content-script-api.tsx";

export const SessionIdCtx = React.createContext<string>("");
export const MainAPICtx = React.createContext<Comlink.Remote<MainContentScriptAPI>>({} as any);
export const IsolatedAPICtx = React.createContext<IsolatedContentScriptAPI>({} as any);
export const SessionAPICtx = React.createContext<Comlink.Remote<SessionAPI>>({} as any);

export const zPanelSettings = z.object({
  isSyncEnabled: z.optional(z.boolean()),
});

export type PanelSettings = z.infer<typeof zPanelSettings>;
export const PanelSettingsCtx = React.createContext<PanelSettings>({});

export interface FunctionCallRenderJob<I = any, O = any> {
  jobId: string;
  componentName: string;
  props: I;
  resolvers: PromiseWithResolvers<O>;
  finished: false | "SUCCESS" | "ERROR";
}
export const FunctionCallRenderJobsCtx = React.createContext<Map<string, FunctionCallRenderJob>>(new Map());
