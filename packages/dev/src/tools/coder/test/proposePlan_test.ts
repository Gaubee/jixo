import type {RenderPayload} from "@jixo/tools-uikit";
import {assertEquals, assertExists} from "jsr:@std/assert";
import {describe, it} from "jsr:@std/testing/bdd";
import type {ToolContext} from "../coder/askUser.js";
import {functionCall, paramsSchema} from "../coder/proposePlan.js";

describe("proposePlan tool", () => {
  const planArgs = {
    plan_summary: "Refactor the core module",
    steps: ["Step 1: Delete old files", "Step 2: Create new files"],
    estimated_tool_calls: ["submitChangeSet"],
  };

  it("should return PLAN_APPROVED when user approves", async () => {
    let capturedPayload: RenderPayload | null = null;
    const mockRender = (payload: RenderPayload): Promise<boolean> => {
      capturedPayload = payload;
      return Promise.resolve(true); // Simulate user clicking "Approve"
    };
    const mockContext: ToolContext = {render: mockRender};

    paramsSchema.parse(planArgs);
    const result = await functionCall(planArgs, mockContext);

    assertEquals(result.status, "PLAN_APPROVED");
    assertExists(capturedPayload);
    assertEquals(capturedPayload.component, "ProposePlanDialog");
    assertEquals(capturedPayload.props.plan_summary, "Refactor the core module");
  });

  it("should throw an error when user rejects", async () => {
    const mockRender = (_payload: RenderPayload): Promise<boolean> => {
      return Promise.resolve(false); // Simulate user clicking "Reject"
    };
    const mockContext: ToolContext = {render: mockRender};

    let caughtError: Error | null = null;
    try {
      await functionCall(planArgs, mockContext);
    } catch (e) {
      caughtError = e;
    }

    assertExists(caughtError);
    assertEquals(caughtError.message, "Plan was rejected by the user.");
  });

  it("should propagate errors from the render function (e.g., user cancellation)", async () => {
    const mockRender = (_payload: RenderPayload): Promise<any> => {
      return Promise.reject(new Error("User closed the window"));
    };
    const mockContext: ToolContext = {render: mockRender};

    let caughtError: Error | null = null;
    try {
      await functionCall(planArgs, mockContext);
    } catch (e) {
      caughtError = e;
    }

    assertExists(caughtError);
    assertEquals(caughtError.message, "User closed the window");
  });
});
