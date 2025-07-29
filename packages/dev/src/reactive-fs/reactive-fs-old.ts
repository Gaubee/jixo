import {createAcontext, useAcontexts} from "@gaubee/node";
import parcelWatcher from "@parcel/watcher";
import {globbySync} from "globby";
import {readFileSync, watchFile, type WatchFileOptions} from "node:fs";
import {Signal} from "signal-polyfill";
import {effect} from "signal-utils/subtle/microtask-effect";
const ONCE_AC = createAcontext("ONCE", () => false);
export type ReactiveFileWatchOptions = WatchFileOptions;
export type ReactiveDirWatchOptions = parcelWatcher.Options;
const FILE_WATCH_OPTIONS_AC = createAcontext("FILE_WATCH_OPTIONS", () => ({}) as ReactiveFileWatchOptions);
const DIR_WATCH_OPTIONS_AC = createAcontext("DIR_WATCH_OPTIONS", () => ({}) as ReactiveDirWatchOptions);

const getState = <T>(initialValue: T, opts?: Signal.Options<T>) => new Signal.State(initialValue, opts);
const readFile = (filepath: string, once: boolean = ONCE_AC.get(), fileWatchOptions = FILE_WATCH_OPTIONS_AC.get()) => {
  const fileState = getState(readFileSync(filepath, "utf-8"));
  if (!once) {
    const watcher = watchFile(filepath, {...fileWatchOptions, bigint: false}, () => {
      try {
        fileState.set(readFileSync(filepath, "utf-8"));
      } catch {
        console.log(`File ${filepath} not found, stopping watcher.`);
        watcher.unref();
        // off();
      }
    });
    effect(() => {
      console.log("File changed:", filepath, fileState.get().length);
    });
  }
  return fileState.get();
};
const readDirByGlob = (dirname: string, glob: string = "*", once: boolean = ONCE_AC.get(), dirWatchOptions = DIR_WATCH_OPTIONS_AC.get()) => {
  const dirState = getState(globbySync(glob, {cwd: dirname}), {
    equals(t, t2) {
      return t.length === t2.length && t.every((file, i) => file === t2[i]);
    },
  });
  if (!once) {
    const subp = parcelWatcher.subscribe(
      dirname,
      (err, events) => {
        if (events.some((event) => event.type === "create" || event.type === "delete")) {
          try {
            dirState.set(globbySync(glob, {cwd: dirname}));
          } catch {
            subp.then((sub) => sub.unsubscribe());
            // off();
          }
        }
      },
      dirWatchOptions,
    );
  }
  return dirState.get();
};

export const useReactiveFs = (
  run: () => Promise<void>,
  opts?: {
    once?: boolean;
    fileWatchOptions?: ReactiveFileWatchOptions;
    dirWatchOptions?: ReactiveDirWatchOptions;
  },
) => {
  const once = opts?.once ?? ONCE_AC.get();
  const fileWatchOptions = opts?.fileWatchOptions ?? FILE_WATCH_OPTIONS_AC.get();
  const dirWatchOptions = opts?.dirWatchOptions ?? DIR_WATCH_OPTIONS_AC.get();

  const offp = useAcontexts([
    // keys
    ONCE_AC,
    FILE_WATCH_OPTIONS_AC,
    DIR_WATCH_OPTIONS_AC,
  ])(
    [
      // values
      once,
      fileWatchOptions,
      dirWatchOptions,
    ],
    async () => {
      if (once) {
        await run();
      } else {
        return effect(() => {
          console.log("OKK, reactiveFs use");
          return run();
        });
      }
    },
  );

  return () => offp.then((off) => off?.());
};

export const reactiveFs = {
  getState: getState,
  readFile: readFile,
  readDirByGlob: readDirByGlob,
  use: useReactiveFs,
};

// const v = new Signal.State(0, {
//   [Signal.subtle.watched]() {
//     console.log("watched");
//   },
//   [Signal.subtle.unwatched]() {
//     console.log("unwatched");
//   },
// });
// effect(async () => {
//   await delay(1);
//   console.log("QAQ read", v.get());
// });

// setInterval(() => {
//   v.set(v.get() + 1);
//   console.log("QAQ write", v.get());
// }, 1000);
