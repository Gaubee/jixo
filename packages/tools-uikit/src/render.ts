import {v4 as uuidv4} from "uuid";
import type {RenderFunction, RenderHandler, RenderPayload, UIRenderCommand} from "./types.ts";

/**
 * Creates a `render` function that is bound to a specific backend handler and session.
 * This is the factory that decouples the tools from the communication layer.
 *
 * @param handler - An async function provided by the host environment (e.g., jixo-node)
 *                  that knows how to send a command to a UI client and await its response.
 * @param sessionId - The specific user session this renderer will target.
 * @returns A `render` function that can be passed to tools.
 */
export function createRenderer(handler: RenderHandler, sessionId: string): RenderFunction {
  /**
   * The actual render function that will be used by tools like `askUser`.
   * @param payload - The UI component and props to render.
   * @returns A promise that resolves with the user's response or rejects on error/cancel.
   */
  const render: RenderFunction = (payload: RenderPayload): Promise<any> => {
    const command: UIRenderCommand = {
      type: "RENDER_UI",
      jobId: uuidv4(),
      payload,
    };

    // The handler is responsible for sending the command, waiting for the
    // UIResponse with the matching jobId, and resolving/rejecting this promise.
    return handler(sessionId, command);
  };

  return render;
}
