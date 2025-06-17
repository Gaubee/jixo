import {openai} from "@ai-sdk/openai";

export const commonModel = openai("gpt-4o-mini");
export const thinkModel = openai("gpt-4o");
