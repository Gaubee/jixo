import {JixoApp} from "./app.js";

export const isJixoApp = (app: unknown): app is JixoApp => {
  try {
    return app instanceof JixoApp;
  } catch {
    return false;
  }
};

export type Assert = (isJixo: boolean) => asserts isJixo;
export const ok: Assert = (isJixo: boolean): asserts isJixo => {
  if (!isJixo) {
    // Corrected logic: throw if it's NOT a Jixo app
    throw new Error("App is not a JixoApp");
  }
};

export const assertJixoApp = (app: unknown): JixoApp => {
  if (!app) throw new Error("Mastra app instance is not available.");
  ok(isJixoApp(app));
  return app;
};
