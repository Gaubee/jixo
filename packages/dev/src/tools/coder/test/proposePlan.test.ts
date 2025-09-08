import type {RenderPayload} from "@jixo/tools-uikit";
import assert from "node:assert";
import {describe, expect, it} from "vitest";
import type {ToolContext} from "../../types.js";
import {functionCall, paramsSchema} from "../proposePlan.function_call.js";

describe("proposePlan tool", () => {
  const planArgs = {
    plan_summary: "Refactor the core module",
    steps: ["Step 1: Delete old files", "Step 2: Create new files"],
    estimated_tool_calls: ["submitChangeSet"],
  };

  it("should return PLAN_APPROVED when user approves", async () => {
    let capturedPayload: RenderPayload | undefined;
    const mockRender = (payload: RenderPayload): Promise<boolean> => {
      capturedPayload = payload;
      return Promise.resolve(true); // Simulate user clicking "Approve"
    };
    const mockContext: ToolContext = {render: mockRender, sessionId: "test-session"};

    paramsSchema.parse(planArgs);
    const result = await functionCall(planArgs, mockContext);

    expect(result.status).toBe("PLAN_APPROVED");
    assert.ok(capturedPayload);
    expect(capturedPayload.component).toBe("ProposePlanDialog");
    expect(capturedPayload.props.plan_summary).toBe("Refactor the core module");
  });

  it("should throw an error when user rejects", async () => {
    const mockRender = (_payload: RenderPayload): Promise<boolean> => {
      return Promise.resolve(false); // Simulate user clicking "Reject"
    };
    const mockContext: ToolContext = {render: mockRender, sessionId: "test-session"};

    await expect(functionCall(planArgs, mockContext)).rejects.toThrow("Plan was rejected by the user.");
  });

  it("should propagate errors from the render function (e.g., user cancellation)", async () => {
    const mockRender = (_payload: RenderPayload): Promise<any> => {
      return Promise.reject(new Error("User closed the window"));
    };
    const mockContext: ToolContext = {render: mockRender, sessionId: "test-session"};

    await expect(functionCall(planArgs, mockContext)).rejects.toThrow("User closed the window");
  });
});
