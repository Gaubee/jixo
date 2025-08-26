import {assertEquals} from "jsr:@std/assert";
import {describe, it} from "jsr:@std/testing/bdd";
import {functionCall, paramsSchema} from "./logThought.ts";

describe("logThought", () => {
  it("should successfully log a non-conclusive thought", () => {
    const args = {
      thought: "First, I need to analyze the problem.",
      step: 1,
      total_steps: 3,
      is_conclusive: false,
    };
    paramsSchema.parse(args); // Zod validation
    const result = functionCall(args);
    assertEquals(result.status, "THOUGHT_LOGGED");
    assertEquals(result.step, 1);
    assertEquals(result.is_conclusive, false);
  });

  it("should successfully log a conclusive thought", () => {
    const args = {
      thought: "I have a complete plan now.",
      step: 3,
      total_steps: 3,
      is_conclusive: true,
    };
    paramsSchema.parse(args);
    const result = functionCall(args);
    assertEquals(result.status, "THOUGHT_LOGGED");
    assertEquals(result.is_conclusive, true);
  });

  it("should fail Zod validation if step is not a positive integer", () => {
    const args = {thought: "test", step: 0, total_steps: 1, is_conclusive: false};
    assertEquals(paramsSchema.safeParse(args).success, false);
  });

  it("should fail Zod validation if total_steps is not a positive integer", () => {
    const args = {thought: "test", step: 1, total_steps: 0, is_conclusive: false};
    assertEquals(paramsSchema.safeParse(args).success, false);
  });

  it("should fail Zod validation if is_conclusive is not a boolean", () => {
    const args = {thought: "test", step: 1, total_steps: 1, is_conclusive: "false"};
    assertEquals(paramsSchema.safeParse(args as any).success, false);
  });
});

// JIXO_CODER_EOF
