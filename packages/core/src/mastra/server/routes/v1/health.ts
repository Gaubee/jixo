import {registerApiRoute} from "@mastra/core/server";
import type {ApiRoute} from "../types.js";

export const healthApi: ApiRoute[] = [
  registerApiRoute("/jixo/v1/health", {
    method: "GET",
    handler: async (c) => {
      return c.json({status: "ok", timestamp: new Date().toISOString()});
    },
  }),
];
