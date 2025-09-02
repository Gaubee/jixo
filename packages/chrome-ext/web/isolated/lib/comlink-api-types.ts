// This file is the single source of truth for all Comlink API type definitions.

import type {BackgroundAPI} from "../../../service-worker/comlink.ts"; // Fixed casing
import type {sidePanelAPI} from "../../../service-worker/sidepanel.ts";
import type {isolatedContentScriptAPI} from "./content-script-api.tsx";

export type {BackgroundAPI}; // Export the type
export type SidePanelAPI = typeof sidePanelAPI;
export type ContentScriptAPI = typeof isolatedContentScriptAPI;

export interface JixoTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  isActive: boolean;
}
