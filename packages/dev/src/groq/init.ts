import {commonInit, type InitOptions} from "../google-aistudio/jixo/init.js";

export type {InitOptions};
export const doInit = async (opts: InitOptions) => {
  return commonInit(["groq.browser.js"], opts);
};
