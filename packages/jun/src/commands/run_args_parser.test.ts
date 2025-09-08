import {describe, expect, it} from "vitest";
import {parseRunArgs} from "./run_args_parser.js";

describe("parseRunArgs", () => {
  it("should parse a simple command", () => {
    const result = parseRunArgs(["echo", "hello"]);
    expect(result).toEqual({
      command: "echo",
      commandArgs: ["hello"],
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
    const result = parseRunArgs(["--json"]);
    expect("error" in result).toBe(true);
  });
});
