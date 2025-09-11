import {createAcontext, useAcontexts} from "@gaubee/node"; // Preserving your dependency
import {map_get_or_put} from "@gaubee/util";
import parcelWatcher from "@parcel/watcher";
import Debug from "debug";
import {globbySync, type Options as GlobbyOptions} from "globby";
import {existsSync, readFileSync, watchFile, type WatchFileOptions} from "node:fs";
import path from "node:path";
import {ReactiveContext, ReactiveState} from "./reactive-context.js";

const ONCE_AC = createAcontext("ONCE", () => false);
export type ReactiveFileWatchOptions = WatchFileOptions;
export type ReactiveDirWatchOptions = parcelWatcher.Options;
const FILE_WATCH_OPTIONS_AC = createAcontext("FILE_WATCH_OPTIONS", () => ({}) as ReactiveFileWatchOptions);
const DIR_WATCH_OPTIONS_AC = createAcontext("DIR_WATCH_OPTIONS", () => ({}) as ReactiveDirWatchOptions);

// --- State Management: Centralized cache for ReactiveState instances ---
const stateCache = new Map<string, ReactiveState<any>>();

// --- Public API Functions ---
const debug = Debug("jixo:reactive-fs-v2");

const readFile = (filepath: string): string => {
  filepath = path.resolve(filepath);
  const key = `file:${filepath}`;
  const getValue = () => (existsSync(filepath) ? readFileSync(filepath, "utf-8") : "");
  const fileState = map_get_or_put(stateCache, key, () => new ReactiveState(getValue()));

  // In watch mode, update the state based on the latest file content.
  // This happens *inside* a ReactiveContext run.
  if (!ONCE_AC.get()) {
    debug("watch file", filepath);
    const fileWatchOptions = FILE_WATCH_OPTIONS_AC.get();
    const watcher = watchFile(filepath, {...fileWatchOptions, bigint: false}, () => {
      try {
        const changed = fileState.set(getValue());
        if (changed) {
          debug("file changed", filepath);
        }
      } catch {
        console.log(`File ${filepath} not found, stopping watcher.`);
        watcher.unref();
      }
    });
  }

  return fileState.get();
};

const readDirByGlob = (dirname: string, glob: string | readonly string[] = "*", globbyOptions?: GlobbyOptions): string[] => {
  dirname = path.resolve(dirname);
  const getValue = () => {
    return globbySync(glob, {cwd: dirname, ...globbyOptions});
  };
  const key = `glob:${dirname}:${JSON.stringify(Array.isArray(glob) ? glob : [glob])}`;
  const globState = map_get_or_put(
    stateCache,
    key,
    () =>
      new ReactiveState(getValue(), {
        equals: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
      }),
  );

  if (!ONCE_AC.get()) {
    const dirWatchOptions = DIR_WATCH_OPTIONS_AC.get();
    debug("watch dir", dirname);
    const subp = parcelWatcher.subscribe(
      dirname,
      (err, events) => {
        if (events.some((event) => event.type === "create" || event.type === "delete")) {
          try {
            const changed = globState.set(getValue());
            if (changed) {
              debug("dir changed", dirname);
            }
          } catch {
            subp.then((sub) => sub.unsubscribe());
          }
        }
      },
      dirWatchOptions,
    );

    const freshList = globbySync(glob, {cwd: dirname, ...globbyOptions});
    globState.set(freshList);
  }

  return globState.get();
};

const useReactiveFs = (
  run: () => Promise<void>,
  opts: {
    signal?: AbortSignal;
    once?: boolean;
    fileWatchOptions?: ReactiveFileWatchOptions;
    dirWatchOptions?: ReactiveDirWatchOptions;
  } = {},
) => {
  const once = opts?.once ?? ONCE_AC.get();
  const fileWatchOptions = opts?.fileWatchOptions ?? FILE_WATCH_OPTIONS_AC.get();
  const dirWatchOptions = opts?.dirWatchOptions ?? DIR_WATCH_OPTIONS_AC.get();

  const context = new ReactiveContext(run, !once);
  return useAcontexts([
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
    () => {
      return context.run(opts);
    },
  );
};

// --- The final exported object, matching your original structure ---
export const reactiveFs = {
  // We don't export a generic `getState` anymore, as state creation is now an
  // implementation detail of the fs functions. This makes the public API cleaner.
  // getState: ...,
  readFile,
  readDirByGlob,
  use: useReactiveFs,
};
