import {z} from "zod/v4-mini";
import type {TaskRunner} from "../node/utils.js";

// ... (zod schema and doEventStream are unchanged)
export const zEventStreamTask = z.object({
  type: z.literal("event-stream"),
  taskId: z.string(),
  url: z.string(),
  init: z.any(),
  status: z.enum(["initial", "pending", "streaming", "fulfilled", "rejected"]),
  messages: z.array(z.string()),
  result: z.any(),
  done: z.boolean(),
});
export type EventStreamTask = z.output<typeof zEventStreamTask>;

export async function* doEventStream(input: EventStreamTask): AsyncGenerator<{changed: boolean; output: EventStreamTask}> {
  const output = {...input};
  let resolveNextEvent: (value: {data?: string; done?: boolean; error?: Error}) => void;
  let eventPromise = new Promise<{data?: string; done?: boolean; error?: Error}>((res) => (resolveNextEvent = res));
  const eventSource = new EventSource(input.url, input.init);
  eventSource.onopen = () => {
    output.status = "streaming";
  };
  eventSource.onmessage = (event) => {
    const currentResolver = resolveNextEvent;
    eventPromise = new Promise((res) => (resolveNextEvent = res));
    currentResolver({data: event.data});
  };
  eventSource.onerror = () => {
    const currentResolver = resolveNextEvent;
    eventSource.close();
    currentResolver({done: true, error: new Error("EventSource connection error.")});
  };
  await Promise.race([eventPromise, new Promise((r) => setTimeout(r, 100))]);
  if (output.status !== "streaming") {
    output.status = "rejected";
    output.done = true;
    output.result = "Failed to open EventSource connection.";
    yield {changed: true, output};
    return;
  }
  yield {changed: true, output};
  while (true) {
    const event = await eventPromise;
    if (event.error) {
      output.status = "rejected";
      output.result = event.error;
      output.done = true;
      yield {changed: true, output};
      break;
    }
    if (event.data && event.data === "[DONE]") {
      eventSource.close();
      output.status = "fulfilled";
      output.done = true;
      yield {changed: true, output};
      break;
    }
    if (event.done) {
      output.status = "fulfilled";
      output.done = true;
      yield {changed: true, output};
      break;
    }
    if (event.data) {
      output.messages.push(event.data);
      yield {changed: true, output};
    }
  }
}

export const createRunEventStreamInBrowser = (runner: TaskRunner) => {
  return async function* (dir: string, url: string, init?: EventSourceInit): AsyncGenerator<string> {
    const taskId = crypto.randomUUID();
    const initialTask: EventStreamTask = {
      type: "event-stream",
      taskId,
      url,
      init,
      status: "initial",
      messages: [],
      result: null,
      done: false,
    };
    let currentTask = await runner<EventStreamTask>({
      dir,
      initialTask,
      waitUntil: (task) => task.status === "streaming" || task.done,
    });
    if (currentTask.status !== "streaming") {
      throw currentTask.result || new Error(`Failed to establish event stream. Final status: ${currentTask.status}`);
    }
    let yieldedCount = 0;
    while (!currentTask.done) {
      for (let i = yieldedCount; i < currentTask.messages.length; i++) {
        yield currentTask.messages[i];
      }
      yieldedCount = currentTask.messages.length;
      currentTask = await runner<EventStreamTask>({
        dir,
        // Use the new, cleaner 'poll' option
        poll: {taskId, type: "event-stream"},
        waitUntil: (task) => task.messages.length > yieldedCount || task.done,
      });
    }
    for (let i = yieldedCount; i < currentTask.messages.length; i++) {
      yield currentTask.messages[i];
    }
    if (currentTask.status === "rejected") {
      throw currentTask.result;
    }
  };
};
