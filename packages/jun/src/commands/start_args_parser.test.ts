import {describe, expect, it} from "vitest";
import {parseStartArgs} from "./start_args_parser.js";

describe("parseStartArgs", () => {
  it("should parse a simple command for start", () => {
    const result = parseStartArgs(["npm", "run", "dev"]);
    expect(result).toEqual({
      command: "npm",
      commandArgs: ["run", "dev"],
      json: false,
      output: "raw",
      mode: "tty",
    });
  });

  it("should handle --json and --mode flags", () => {
    const result = parseStartArgs(["--json", "--mode", "cp", "--", "vite"]);
    expect(result).toEqual({
      command: "vite",
      commandArgs: [],
      json: true,
      output: "raw",
      mode: "cp",
    });
  });

  it("should treat unrecognized flags as part of the command", () => {
    const result = parseStartArgs(["--timeout", "100", "sleep", "10"]);
    expect(result).toEqual({
      command: "--timeout",
      commandArgs: ["100", "sleep", "10"],
      json: false,
      output: "raw",
      mode: "tty",
    });
  });

  it("should return an error if no command is provided", () => {
    const result = parseStartArgs(["--json"]);
    expect("error" in result).toBe(true);
  });
});
