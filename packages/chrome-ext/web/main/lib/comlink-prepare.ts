import * as Comlink from "comlink";
import {mainContentScriptAPI} from "./content-script-api";
export function comlinkPrepare() {
  window.addEventListener("message", (event) => {
    if (event.data === "jixo-ioslated-connect") {
      const port = event.ports[0];
      Comlink.expose(mainContentScriptAPI, port);
    }
  });
}
