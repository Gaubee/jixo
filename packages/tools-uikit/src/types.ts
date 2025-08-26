/**
 * The payload that describes a UI rendering job.
 * This is what a tool sends to the render function.
 */
export interface RenderPayload {
  component: string; // The name of the UI component to render, e.g., "AskUserDialog"
  props: Record<string, any>; // The props to pass to the component
}

/**
 * The message sent from the render backend (e.g., jixo-node) to the UI client (e.g., Chrome Ext).
 */
export interface UIRenderCommand {
  type: "RENDER_UI";
  jobId: string;
  payload: RenderPayload;
}

/**
 * The message sent from the UI client back to the render backend.
 */
export interface UIResponse {
  type: "USER_RESPONSE";
  jobId: string;
  payload: {
    data?: any;
    error?: string;
  };
}

/**
 * A handler that defines the backend communication logic for the renderer.
 * This is implemented by the host environment (e.g., jixo-node).
 */
export type RenderHandler = (sessionId: string, command: UIRenderCommand) => Promise<any>;

/**
 * The `render` function signature that tool authors will use.
 */
export type RenderFunction = (payload: RenderPayload) => Promise<any>;
