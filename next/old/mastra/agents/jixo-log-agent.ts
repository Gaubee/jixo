import {Agent} from "@mastra/core/agent";
import {LibSQLStore} from "@mastra/libsql";
import {Memory} from "@mastra/memory";
import {commonModel} from "../llm/gogole.js";
import {weatherTool} from "../tools/weather-tool.js";

export const jixoLogAgent = new Agent({
  name: "Jixo Log Agent",
  instructions: `
You are a helpful weather assistant that provides accurate weather information.
 
Your primary function is to help users get weather details for specific locations. When responding:
- Always ask for a location if none is provided
- If the location name isn't in English, please translate it
- Include relevant details like humidity, wind conditions, and precipitation
- Keep responses concise but informative
 
Use the weatherTool to fetch current weather data.`,
  model: commonModel,
  tools: {weatherTool},

  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db", // path is relative to the .mastra/output directory
    }),
  }),
});
