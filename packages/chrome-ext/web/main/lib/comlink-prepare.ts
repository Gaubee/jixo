import {Comlink} from "@jixo/dev/comlink";
import {MainContentScriptAPI} from "./content-script-api";
export function comlinkPrepare() {
  window.addEventListener("message", (event) => {
    const {data} = event;
    if (typeof data === "string" && data.startsWith("jixo-ioslated-connect/")) {
      const sessionId = data.split("/")[1];
      const port = event.ports[0];
      Comlink.expose(new MainContentScriptAPI(sessionId), port);
    }
  });
}
