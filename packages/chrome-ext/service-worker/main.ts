import {initializeComlink} from "./comlink.ts";
import {initializeSidePanel} from "./sidepanel.ts";
export type {BackgroundAPI} from "./comlink.ts";

console.log("JIXO BG: Service Worker starting up...");

// Initialize all sub-systems.
initializeSidePanel();
initializeComlink();

console.log("JIXO BG: All services initialized.");
