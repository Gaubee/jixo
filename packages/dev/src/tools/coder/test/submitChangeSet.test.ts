import type {RenderPayload} from "@jixo/tools-uikit";
import assert from "node:assert";
import {describe, expect, it} from "vitest";
import type {ToolContext} from "../../types.js";
import {functionCall, paramsSchema} from "../submitChangeSet.function_call.js";

describe("submitChangeSet tool", () => {
  const changeSetArgs = {
    change_log: "feat: implement new feature",
    operations: [
      {
        type: "writeFile" as const,
        path: "/src/index.ts",
        content: "console.log('new feature');",
      },
    ],
    final_statement: "The new feature has been implemented.",
  };

  it("should return approved status and operations when user approves", async () => {
    let capturedPayload: RenderPayload | undefined;
    const mockRender = (payload: RenderPayload): Promise<boolean> => {
      capturedPayload = payload;
      return Promise.resolve(true); // Simulate user approval
    };
    const mockContext: ToolContext = {render: mockRender, sessionId: "test-session"};

    paramsSchema.parse(changeSetArgs);
    const result = await functionCall(changeSetArgs, mockContext);

    expect(result.status).toBe("CHANGESET_APPROVED");
    expect(result.operations).toEqual(changeSetArgs.operations);
    expect(result.final_statement).toBe(changeSetArgs.final_statement);

    assert.ok(capturedPayload);
    expect(capturedPayload.component).toBe("SubmitChangeSetPanel");
    expect(capturedPayload.props.change_log).toBe(changeSetArgs.change_log);
  });

  it("should throw an error when user rejects the changeset", async () => {
    const mockRender = (_payload: RenderPayload): Promise<boolean> => {
      return Promise.resolve(false); // Simulate user rejection
    };
    const mockContext: ToolContext = {render: mockRender, sessionId: "test-session"};

    await expect(functionCall(changeSetArgs, mockContext)).rejects.toThrow("Changeset was rejected by the user.");
  });

  it("should propagate errors from the render function", async () => {
    const mockRender = (_payload: RenderPayload): Promise<any> => {
      return Promise.reject(new Error("UI failed to render"));
    };
    const mockContext: ToolContext = {render: mockRender, sessionId: "test-session"};

    await expect(functionCall(changeSetArgs, mockContext)).rejects.toThrow("UI failed to render");
  });
});
