import type {Mastra} from "@mastra/core";
import type {JixoApp} from "./app.js";

export const JixoApp_WS = new WeakSet<JixoApp>();

export const isJixoApp = (app: Mastra): app is JixoApp => {
  return JixoApp_WS.has(app as any);
};

export type Assert = (isJixo: boolean) => asserts isJixo;
export const assert: Assert = (isJixo: boolean): asserts isJixo => {
  if (isJixo) {
    throw new Error("App is not a Jixo app");
  }
};
