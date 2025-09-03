import {initializeComlink} from "./comlink.ts";
import {setupContentScriptInjecter} from "./inject-content-script.ts";
import {initializeSidePanel} from "./sidepanel.ts";
import {globalWebSocket} from "./websocket.ts";

console.log("JIXO BG: Service Worker starting up...");

const {backgroundAPI, contentScriptPorts} = initializeComlink();
initializeSidePanel(contentScriptPorts);
globalWebSocket.initialize(backgroundAPI);

console.log("JIXO BG: All services initialized.");
setupContentScriptInjecter();

export type {BackgroundAPI} from "./comlink.ts";
