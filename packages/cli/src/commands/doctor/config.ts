import {blue, green} from "@gaubee/nodekit";
import type {DoctorConfig} from "./types.js";

export const myDoctorConfig: DoctorConfig = [
  {
    id: "jixo-core-service",
    displayName: "JIXO Core Service",
    installationHint: `Ensure the JIXO Core service is running. You can start it with 'jixo daemon start'.`,
  },
  {
    id: "pnpm",
    displayName: "PNPM Package Manager",
    versionCommand: "pnpm --version",
    versionParseRegex: /(\d+\.\d+\.\d+)/, // Assumes pnpm --version outputs just the version or "X.Y.Z ..."
    minVersion: "10.9.0",
    installationHint: `Install pnpm via npm: ${green("npm install -g pnpm")}. Or visit ${blue("https://pnpm.io/installation")}`,
  },
];
