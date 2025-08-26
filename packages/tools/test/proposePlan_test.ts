import {assertEquals} from "jsr:@std/assert";
import {describe, it} from "jsr:@std/testing/bdd";
import {functionCall, paramsSchema} from "./proposePlan.ts";

describe("proposePlan", () => {
  it("should successfully process a valid plan with estimated tool calls", () => {
    const args = {
      plan_summary: "Refactor the core module",
      steps: ["Step 1: Delete old files", "Step 2: Create new files"],
      estimated_tool_calls: ["submitChangeSet"],
    };
    paramsSchema.parse(args); // Zod validation
    const result = functionCall(args);
    assertEquals(result.status, "PLAN_PROPOSED");
    assertEquals(result.message, "Plan has been received and is pending user approval.");
    assertEquals(result.plan, args);
  });

  it("should successfully process a valid plan without estimated tool calls", () => {
    const args = {
      plan_summary: "Update documentation",
      steps: ["Step 1: Review current docs", "Step 2: Update README.md"],
    };
    paramsSchema.parse(args);
    const result = functionCall(args);
    assertEquals(result.status, "PLAN_PROPOSED");
    assertEquals(result.plan.plan_summary, "Update documentation");
    assertEquals(result.plan.steps.length, 2);
  });

  it("should fail Zod validation if plan_summary is missing", () => {
    const args = {
      steps: ["A", "B"],
    };
    assertEquals(paramsSchema.safeParse(args).success, false);
  });

  it("should fail Zod validation if steps are missing", () => {
    const args = {
      plan_summary: "A summary",
    };
    assertEquals(paramsSchema.safeParse(args).success, false);
  });
});

// JIXO_CODER_EOF
