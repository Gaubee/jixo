import {gray, type Spinner} from "@gaubee/nodekit";
import ms from "ms";
import type {AiTask} from "../../helper/resolve-ai-tasks.js";

export class AiTaskTui {
  endInfo = (() => {
    const self = this;
    return {
      prefixText: "",
      text: "",
      get suffixText() {
        return `⏱️  ${gray(ms(new Date().getTime() - new Date(self.ai_task.startTime).getTime(), {long: true}))}`;
      },
    };
  })();
  constructor(
    readonly ai_task: AiTask,
    readonly spinner: Spinner,
  ) {
    this.prefixText = this.spinner.prefixText;
  }
  #status = new Map<string, string>();
  setStatus(key: string, value: string) {
    this.#status.set(key, value);
    this.#updatePrefixText();
  }
  getStatus(key: string) {
    return this.#status.get(key);
  }
  removeStatus(key: string) {
    return this.#status.delete(key);
  }
  #prefixText = "";
  #updatePrefixText = () => {
    this.spinner.prefixText = `${[...this.#status.values()].join(" ")}\n${this.#prefixText}`;
  };
  get text() {
    return this.spinner.text;
  }
  set text(v) {
    this.spinner.text = v;
  }
  get prefixText() {
    return this.#prefixText;
  }
  set prefixText(v) {
    this.#prefixText = v;
    this.#updatePrefixText();
  }
  stop() {
    this.spinner.stopAndPersist(this.endInfo);
  }
}
