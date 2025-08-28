import {assertEquals} from "@std/assert";
import {describe, it} from "@std/testing/bdd";
import {parseRunArgs} from "./run_args_parser.ts";

describe("parseRunArgs", () => {
  it("should parse a simple command", () => {
    const result = parseRunArgs(["echo", "hello"]);
    assertEquals(result, {
      command: "echo",
      commandArgs: ["hello"],
      background: false,
      json: false,
    });
  });

  it("should parse a command with flags", () => {
    const result = parseRunArgs(["tsc", "--watch", "--project", "tsconfig.json"]);
    assertEquals(result, {
      command: "tsc",
      commandArgs: ["--watch", "--project", "tsconfig.json"],
      background: false,
      json: false,
    });
  });

  it("should correctly handle the -- separator", () => {
    const result = parseRunArgs(["--", "echo", "--version"]);
    assertEquals(result, {
      command: "echo",
      commandArgs: ["--version"],
      background: false,
      json: false,
    });
  });

  it("should parse the --background flag before the command", () => {
    const result = parseRunArgs(["--background", "sleep", "10"]);
    assertEquals(result, {
      command: "sleep",
      commandArgs: ["10"],
      background: true,
      json: false,
    });
  });

  it("should parse the --json flag before the separator", () => {
    const result = parseRunArgs(["--json", "--", "ls", "-la"]);
    assertEquals(result, {
      command: "ls",
      commandArgs: ["-la"],
      background: false,
      json: true,
    });
  });

  it("should parse both --background and --json flags", () => {
    const result = parseRunArgs(["-b", "--json", "--", "npm", "run", "dev"]);
    assertEquals(result, {
      command: "npm",
      commandArgs: ["run", "dev"],
      background: true,
      json: true,
    });
  });

  it("should return an error if no command is provided", () => {
    const result = parseRunArgs([]);
    assertEquals("error" in result, true);
  });

  it("should return an error if only flags are provided", () => {
    const result = parseRunArgs(["--background", "--json"]);
    assertEquals("error" in result, true);
  });
});
