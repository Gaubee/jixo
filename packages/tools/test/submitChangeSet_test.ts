import {assertEquals, assertThrows} from "jsr:@std/assert";
import {describe, it} from "jsr:@std/testing/bdd";
import {functionCall, paramsSchema} from "./submitChangeSet.ts";

describe("submitChangeSet", () => {
  it("should successfully process a valid writeFile operation", () => {
    const args = {
      change_log: "feat: add new file",
      operations: [
        {
          type: "writeFile" as const,
          path: "/test.ts",
          content: 'console.log("hello")',
        },
      ],
      final_statement: "File created.",
    };
    paramsSchema.parse(args); // Zod validation
    const result = functionCall(args);
    assertEquals(result.status, "SUCCESS");
    assertEquals(result.files_affected, 1);
  });

  it("should successfully process a valid deleteFile operation", () => {
    const args = {
      change_log: "refactor: remove old file",
      operations: [
        {
          type: "deleteFile" as const,
          path: "/old.ts",
        },
      ],
      final_statement: "File removed.",
    };
    paramsSchema.parse(args);
    const result = functionCall(args);
    assertEquals(result.status, "SUCCESS");
    assertEquals(result.files_affected, 1);
  });

  it("should successfully process a valid renameFile operation", () => {
    const args = {
      change_log: "refactor: rename file",
      operations: [
        {
          type: "renameFile" as const,
          path: "/old.ts",
          new_path: "/new.ts",
        },
      ],
      final_statement: "File renamed.",
    };
    paramsSchema.parse(args);
    const result = functionCall(args);
    assertEquals(result.status, "SUCCESS");
    assertEquals(result.files_affected, 1);
  });

  it("should throw an error if writeFile operation is missing content", () => {
    const args = {
      change_log: "feat: add new file",
      operations: [
        {
          type: "writeFile" as const,
          path: "/test.ts",
          // content is missing
        },
      ],
      final_statement: "File created.",
    };
    assertThrows(() => functionCall(args as any), Error, `Operation for path "/test.ts" is 'writeFile' but content is missing.`);
  });

  it("should throw an error if renameFile operation is missing new_path", () => {
    const args = {
      change_log: "refactor: rename file",
      operations: [
        {
          type: "renameFile" as const,
          path: "/old.ts",
          // new_path is missing
        },
      ],
      final_statement: "File renamed.",
    };
    assertThrows(() => functionCall(args as any), Error, `Operation for path "/old.ts" is 'renameFile' but new_path is missing.`);
  });

  it("should pass Zod validation with multiple valid operations", () => {
    const args = {
      change_log: "feat: massive change",
      operations: [
        {type: "writeFile" as const, path: "/a.ts", content: "a"},
        {type: "deleteFile" as const, path: "/b.ts"},
        {type: "renameFile" as const, path: "/c.ts", new_path: "/d.ts"},
      ],
      final_statement: "Done.",
    };
    paramsSchema.parse(args);
    const result = functionCall(args);
    assertEquals(result.status, "SUCCESS");
    assertEquals(result.files_affected, 3);
  });
});

// JIXO_CODER_EOF
