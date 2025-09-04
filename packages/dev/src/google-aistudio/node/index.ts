import {gray} from "@gaubee/nodekit";
import {func_remember, func_throttle} from "@gaubee/util";
import {reactiveFs} from "../../reactive-fs/reactive-fs.js";
import {googleAiStudioAutomation, type GoogleAiStudioAutomationOptions} from "./tasks.js";
export * from "./config.js";
export * from "./types.js";
export interface DoGoogleAiStudioAutomationOptions extends GoogleAiStudioAutomationOptions {
  watch?: boolean;
}

export const doGoogleAiStudioAutomation = async ({watch, ...opts}: DoGoogleAiStudioAutomationOptions) => {
  const handle = func_throttle(() => {
    return googleAiStudioAutomation(opts);
  }, 200);

  const printWatchTip = func_remember(() => console.log(gray("\nWatching for file changes... Press Ctrl+C to exit.")));
  await reactiveFs.use(
    async () => {
      await handle();
      if (watch) {
        printWatchTip();
      }
    },
    {
      once: !watch,
    },
  );
};
