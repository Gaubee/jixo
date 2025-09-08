import type {RenderPayload} from "@jixo/tools-uikit";
import {assertEquals, assertExists} from "jsr:@std/assert";
import {describe, it} from "jsr:@std/testing/bdd";
import {functionCall, paramsSchema, type ToolContext} from "./askUser.js";

describe("askUser tool", () => {
  it("should call the render function with the correct payload", async () => {
    let capturedPayload: RenderPayload | null = null;

    // Create a mock render function for testing.
    const mockRender = (payload: RenderPayload): Promise<any> => {
      capturedPayload = payload;
      return Promise.resolve("User answered 'Yes'");
    };

    const mockContext: ToolContext = {
      render: mockRender,
    };

    const args = {
      question: "Proceed?",
      options: ["Yes", "No"],
    };
    paramsSchema.parse(args);

    const result = await functionCall(args, mockContext);

    // Verify the result
    assertEquals(result, "User answered 'Yes'");

    // Verify that the render function was called correctly
    assertExists(capturedPayload);
    assertEquals(capturedPayload.component, "AskUserDialog");
    assertEquals(capturedPayload.props.question, "Proceed?");
    assertEquals(capturedPoad.props.options, ["Yes", "No"]);
  });

  it("should handle rejection from the render function", async () => {
    const mockRender = (_payload: RenderPayload): Promise<any> => {
      return Promise.reject(new Error("User cancelled"));
    };

    const mockContext: ToolContext = {
      render: mockRender,
    };

    const args = {question: "Are you sure?"};

    let caughtError: Error | null = null;
    try {
      await functionCall(args, mockContext);
    } catch (e) {
      caughtError = e;
    }

    assertExists(caughtError);
    assertEquals(caughtError.message, "User cancelled");
  });
});
