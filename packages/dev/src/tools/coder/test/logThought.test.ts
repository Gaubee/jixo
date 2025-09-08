import type {RenderPayload} from "@jixo/tools-uikit";
import assert from "node:assert";
import {describe, expect, it} from "vitest";
import type {ToolContext} from "../../types.js";
import {functionCall, paramsSchema} from "../logThought.function_call.js";

describe("logThought tool", () => {
  it("should call the render function with the correct payload", async () => {
    let capturedPayload: RenderPayload | undefined;
    const mockRender = (payload: RenderPayload): Promise<void> => {
      capturedPayload = payload;
      return Promise.resolve(); // Display-only tools don't need a return value.
    };
    const mockContext: ToolContext = {render: mockRender, sessionId: "test-session"};

    const args = {
      thought: "First, I need to analyze the problem.",
      step: 1,
      total_steps: 3,
      is_conclusive: false,
    };
    paramsSchema.parse(args);

    const result = await functionCall(args, mockContext);

    expect(result.status).toBe("THOUGHT_LOGGED_TO_UI");

    assert.ok(capturedPayload);
    expect(capturedPayload.component).toBe("LogThoughtPanel");
    expect(capturedPayload.props).toEqual(args);
  });
});
