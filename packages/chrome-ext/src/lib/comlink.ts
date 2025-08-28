import type {backgroundAPI} from "../background.ts";
// We import the type directly from the source of truth
import type {contentScriptAPI} from "../content-script.ts";

/**
 * Defines the TypeScript interface for the API exposed by the content script.
 * This ensures type safety when the popup or background script calls its methods.
 * It is derived directly from the implementation in `content-script.ts`.
 */
export type ContentScriptAPI = typeof contentScriptAPI;

/**
 * Defines the TypeScript interface for the API exposed by the background script.
 */
export type BackgroundAPI = typeof backgroundAPI;
