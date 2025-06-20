import path from "node:path";
import {createJixoApp} from "./app.js";

const workDir = path.join(process.cwd(), "./");

export const mastra = createJixoApp(workDir);
