import {initializeComlink} from "./comlink.ts";
import {initializeSidePanel} from "./sidepanel.ts";
import {initializeWebSocket} from "./websocket.ts";

console.log("JIXO BG: Service Worker starting up...");

const {backgroundAPI, contentScriptPorts} = initializeComlink();
initializeSidePanel(contentScriptPorts);
initializeWebSocket(backgroundAPI);

console.log("JIXO BG: All services initialized.");

import {setupContentScriptInjecter} from "./inject-content-script.ts";
setupContentScriptInjecter();

export type {BackgroundAPI} from "./comlink.ts";
