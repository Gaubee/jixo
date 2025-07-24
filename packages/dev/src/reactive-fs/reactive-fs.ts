import {createAcontext} from "@gaubee/node";
import parcelWatcher from "@parcel/watcher";
import {globbySync} from "globby";
import {readFileSync, watch} from "node:fs";
import {Signal} from "signal-polyfill";
import {effect} from "signal-utils/subtle/microtask-effect";
const ONCE_AC = createAcontext("ONCE", () => false);
export const getFileState = (filepath: string, once: boolean = ONCE_AC.get()) => {
  const fileState = new Signal.State(readFileSync(filepath, "utf-8"));
  if (!once) {
    const off = effect(() => {
      const watcher = watch(filepath, () => {
        try {
          fileState.set(readFileSync(filepath, "utf-8"));
        } catch {
          console.log(`File ${filepath} not found, stopping watcher.`);
          watcher.close();
          off();
        }
      });
    });
  }
  return fileState;
};
export const dirGlobState = (dirname: string, glob: string, once: boolean = ONCE_AC.get()) => {
  const dirState = new Signal.State(globbySync(glob, {cwd: dirname}), {
    equals(t, t2) {
      return t.length === t2.length && t.every((file, i) => file === t2[i]);
    },
  });
  if (!once) {
    const off = effect(async () => {
      
      const sub = await parcelWatcher.subscribe(dirname, (err, events) => {
        if (events.some((event) => event.type === "create" || event.type === "delete")) {
          try {
            dirState.set(globbySync(glob, {cwd: dirname}));
          } catch {
            sub.unsubscribe();
            off();
          }
        }
      });
    });
  }
  return dirState;
};

export const useReactiveFs = (run: () => Promise<void>, opts?: {once?: boolean}) => {
  const once = opts?.once ?? ONCE_AC.get();
  const off = effect(() => {
    ONCE_AC.run(once, run);
  });
  if (once) {
    off();
    return () => {};
  }
  return off;
};

export const reactiveFs = {
  getFile: getFileState,
  readDir: dirGlobState,
  use: useReactiveFs,
};
