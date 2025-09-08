import type {RenderPayload} from "@jixo/tools-uikit";
import {assertEquals, assertExists} from "jsr:@std/assert";
import {describe, it} from "jsr:@std/testing/bdd";
import type {ToolContext} from "../coder/askUser.js";
import {functionCall, paramsSchema} from "../coder/logThought.js";

describe("logThought tool", () => {
  it("should call the render function with the correct payload", async () => {
    let capturedPayload: RenderPayload | null = null;
    const mockRender = (payload: RenderPayload): Promise<void> => {
      capturedPayload = payload;
      return Promise.resolve(); // Display-only tools don't need a return value.
    };
    const mockContext: ToolContext = {render: mockRender};

    const args = {
      thought: "First, I need to analyze the problem.",
      step: 1,
      total_steps: 3,
      is_conclusive: false,
    };
    paramsSchema.parse(args);

    const result = await functionCall(args, mockContext);

    assertEquals(result.status, "THOUGHT_LOGGED_TO_UI");

    assertExists(capturedPayload);
    assertEquals(capturedPayload.component, "LogThoughtPanel");
    assertEquals(capturedPayload.props, args);
  });
});
