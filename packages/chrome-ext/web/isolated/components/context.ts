import type {SessionAPI} from "@jixo/dev/browser";
import {Comlink} from "@jixo/dev/comlink";
import React from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api.ts";
import type {IsolatedContentScriptAPI} from "../lib/content-script-api.tsx";

export const SessionIdCtx = React.createContext<string>("");
export const MainAPICtx = React.createContext<Comlink.Remote<MainContentScriptAPI>>({} as any);
export const IsolatedAPICtx = React.createContext<IsolatedContentScriptAPI>({} as any);
export const SessionAPICtx = React.createContext<Comlink.Remote<SessionAPI>>({} as any);
