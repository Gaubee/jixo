import {registerApiRoute} from "@mastra/core/server";

export const healthApi = [
  registerApiRoute("/jixo/v1/health", {
    method: "GET",
    handler: async (c) => {
      return c.json({status: "ok", timestamp: new Date().toISOString()});
    },
  }),
];
