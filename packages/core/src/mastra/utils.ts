import type {Mastra} from "@mastra/core";
import assert from "node:assert";
import type {JixoApp} from "./app.js";

export const JixoApp_WS = new WeakSet<JixoApp>();

export const isJixoApp = (app: Mastra): app is JixoApp => {
  return JixoApp_WS.has(app as any);
};

export type AssertJixoApp = (app: Mastra) => asserts app is JixoApp;

export const assertJixoApp: AssertJixoApp = (app: Mastra): asserts app is JixoApp => {
  assert.ok(isJixoApp(app));
};
