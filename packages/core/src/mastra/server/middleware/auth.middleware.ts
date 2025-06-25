import type {Middleware} from "./types.js";

export const authMiddleWare: Middleware = async (c, next) => {
  // API Key Authentication Middleware for custom routes
  if (c.req.path.startsWith("/jixo")) {
    const authHeader = c.req.header("Authorization");
    const apiKey = process.env.JIXO_API_KEY;

    if (!apiKey) {
      // If no API key is set in the server, allow access but log a warning.
      console.warn("JIXO_API_KEY is not set. All API requests are allowed without authentication.");
      await next();
      return;
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({error: "Unauthorized: Missing API Key"}, 401);
    }

    const token = authHeader.substring(7);
    if (token !== apiKey) {
      return c.json({error: "Forbidden: Invalid API Key"}, 403);
    }
  }
  await next();
};
