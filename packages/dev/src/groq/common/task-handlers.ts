import type {BrowserFsDuplex} from "../fs-duplex/browser.js";
import type {Task} from "./types.js";

/**
 * Defines the new, simplified contract for a browser-side task handler.
 * Instead of a complex async generator, it's a simple async function that
 * receives the duplex instance and the initial task.
 *
 * It is responsible for the entire lifecycle of the task, using the duplex
 * to send and receive data, and its completion (or throwing an error)
 * signals that the task is finished.
 *
 * @param duplex The active BrowserFsDuplex instance for this task.
 * @param initialTask The first task object that initiated this handler.
 * @returns A promise that resolves when the handler has completed its work.
 */
export type TaskHandler<T extends Task = Task> = (duplex: BrowserFsDuplex<Task, "handler">, initialTask: T) => Promise<void>;
