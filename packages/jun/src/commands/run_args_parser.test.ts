import {describe, expect, it} from "vitest";
import {parseRunArgs} from "./run_args_parser.js";

describe("parseRunArgs", () => {
  it("should parse a simple command", () => {
    const result = parseRunArgs(["echo", "hello"]);
    expect(result).toEqual({
      command: "echo",
      commandArgs: ["hello"],
      background: false,
      json: false,
      output: "raw",
      mode: "tty",
    });
  });

  it("should parse a command with flags", () => {
    const result = parseRunArgs(["tsc", "--watch", "--project", "tsconfig.json"]);
    expect(result).toEqual({
      command: "tsc",
      commandArgs: ["--watch", "--project", "tsconfig.json"],
      background: false,
      json: false,
      output: "raw",
      mode: "tty",
    });
  });

  it("should correctly handle the -- separator", () => {
    const result = parseRunArgs(["--", "echo", "--version"]);
    expect(result).toEqual({
      command: "echo",
      commandArgs: ["--version"],
      background: false,
      json: false,
      output: "raw",
      mode: "tty",
    });
  });

  it("should parse the --background flag before the command", () => {
    const result = parseRunArgs(["--background", "sleep", "10"]);
    expect(result).toEqual({
      command: "sleep",
      commandArgs: ["10"],
      background: true,
      json: false,
      output: "raw",
      mode: "tty",
    });
  });

  it("should parse the --json flag before the separator", () => {
    const result = parseRunArgs(["--json", "--", "ls", "-la"]);
    expect(result).toEqual({
      command: "ls",
      commandArgs: ["-la"],
      background: false,
      json: true,
      output: "raw",
      mode: "tty",
    });
  });

  it("should parse both --background and --json flags", () => {
    const result = parseRunArgs(["-b", "--json", "--", "npm", "run", "dev"]);
    expect(result).toEqual({
      command: "npm",
      commandArgs: ["run", "dev"],
      background: true,
      json: true,
      output: "raw",
      mode: "tty",
    });
  });

  it("should return an error if no command is provided", () => {
    const result = parseRunArgs([]);
    expect("error" in result).toBe(true);
  });

  it("should return an error if only flags are provided", () => {
    const result = parseRunArgs(["--background", "--json"]);
    expect("error" in result).toBe(true);
  });
});
