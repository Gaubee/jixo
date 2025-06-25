import type {Mastra} from "@mastra/core";
import type {JixoApp} from "./app.js";

export const isJixoApp = (app: Mastra): app is JixoApp => {
  return app.getWorkflow("jixoJobWorkflow") != null;
};

export type Assert = (isJixo: boolean) => asserts isJixo;
export const ok: Assert = (isJixo: boolean): asserts isJixo => {
  if (!isJixo) { // Corrected logic: throw if it's NOT a Jixo app
    throw new Error("App is not a Jixo app");
  }
};

export const assertJixoApp = (app: Mastra | undefined): JixoApp => {
    if(!app) throw new Error("Mastra app instance is not available.");
    ok(isJixoApp(app));
    return app;
}
