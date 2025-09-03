import * as Comlink from "comlink";
import React from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api.ts";
import type {IsolatedContentScriptAPI} from "../lib/content-script-api.tsx";
import {ControlPanel} from "./ControlPanel.tsx";

interface AppProps {
  mainApi: Comlink.Remote<MainContentScriptAPI>;
  isolatedApi: IsolatedContentScriptAPI;
}

export function App({mainApi, isolatedApi}: AppProps) {
  return <ControlPanel mainApi={mainApi} isolatedApi={isolatedApi} />;
}
