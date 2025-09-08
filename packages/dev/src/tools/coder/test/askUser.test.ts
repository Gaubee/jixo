import type {RenderPayload} from "@jixo/tools-uikit";
import assert from "node:assert";
import {describe, expect, it} from "vitest";
import type {ToolContext} from "../../types.js";
import {functionCall, paramsSchema} from "../askUser.function_call.js";

describe("askUser tool", () => {
  it("should call the render function with the correct payload", async () => {
    let capturedPayload: RenderPayload | undefined;

    // Create a mock render function for testing.
    const mockRender = (payload: RenderPayload): Promise<any> => {
      capturedPayload = payload;
      return Promise.resolve("User answered 'Yes'");
    };

    const mockContext: ToolContext = {
      render: mockRender,
      sessionId: "test-session",
    };

    const args = {
      question: "Proceed?",
      options: ["Yes", "No"],
    };
    paramsSchema.parse(args);

    const result = await functionCall(args, mockContext);

    // Verify the result
    expect(result).toBe("User answered 'Yes'");

    // Verify that the render function was called correctly
    assert.ok(capturedPayload);
    expect(capturedPayload.component).toBe("AskUserDialog");
    expect(capturedPayload.props.question).toBe("Proceed?");
    expect(capturedPayload.props.options).toEqual(["Yes", "No"]);
  });

  it("should handle rejection from the render function", async () => {
    const mockRender = (_payload: RenderPayload): Promise<any> => {
      return Promise.reject(new Error("User cancelled"));
    };

    const mockContext: ToolContext = {
      render: mockRender,
      sessionId: "test-session",
    };

    const args = {question: "Are you sure?"};

    await expect(functionCall(args, mockContext)).rejects.toThrow("User cancelled");
  });
});
