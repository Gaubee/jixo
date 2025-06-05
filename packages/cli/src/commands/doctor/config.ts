import {blue, green} from "@gaubee/nodekit";
import type {DoctorConfig} from "./types.js";
export const myDoctorConfig: DoctorConfig = [
  {
    id: "pnpm",
    displayName: "PNPM Package Manager",
    versionCommand: "pnpm --version",
    versionParseRegex: /(\d+\.\d+\.\d+)/, // Assumes pnpm --version outputs just the version or "X.Y.Z ..."
    minVersion: "10.11.0", // Your requirement was >= 10.11.0, but semver handles this
    installationHint: `Install pnpm via npm: ${green("npm install -g pnpm")}. Or visit ${blue("https://pnpm.io/installation")}`,
  },
  {
    id: "uv",
    displayName: "UVX CLI",
    versionCommand: "uvx --version",
    // Let's assume uvx outputs something like "uvx version 0.7.8"
    versionParseRegex: /uvx\s+(\d+\.\d+\.\d+)/,
    minVersion: "0.7.8",
    installationHint: `Install uv via pip: ${green("pip install uv")}. Or visit ${blue("https://docs.astral.sh/uv/getting-started/installation")}`,
  },
  {
    id: "node",
    displayName: "Node.js Runtime",
    versionCommand: "node --version",
    versionParseRegex: /v([\d.]+)/, // node --version outputs "v18.17.0"
    minVersion: "18.0.0",
    installationHint: "Install Node.js from https://nodejs.org/",
    optional: true, // Example of an optional check
  },
];
