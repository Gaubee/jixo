import {type Options as GlobbyOptions} from "globby";
import {match, P} from "ts-pattern";

export const paramsToGlobbyOptions = (params: Record<string, unknown>, defaults: GlobbyOptions = {}) => {
  const opts = {
    expandDirectories: match(params.expandDirectories)
      .with(P.boolean, (v) => v)
      .with(P.array(P.string), (v) => v)
      .with({files: P.array(P.string).optional(), extensions: P.array(P.string).optional()}, (v) => v)
      .otherwise(() => defaults.expandDirectories),
    gitignore: match(params.gitignore)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.gitignore),
    ignore: match(params.ignore)
      .with(P.string, (v) => [v])
      .with(P.array(P.string), (v) => v)
      .otherwise(() => defaults.ignore),
    ignoreFiles: match(params.ignoreFiles)
      .with(P.string, P.array(P.string), (v) => v)
      .otherwise(() => defaults.ignoreFiles),
    cwd: match(params.cwd)
      .with(P.string, (v) => v)
      .otherwise(() => defaults.cwd),
    absolute: match(params.absolute)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.absolute),
    baseNameMatch: match(params.baseNameMatch)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.baseNameMatch),
    braceExpansion: match(params.braceExpansion)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.braceExpansion),
    caseSensitiveMatch: match(params.caseSensitiveMatch)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.caseSensitiveMatch),
    concurrency: match(params.concurrency)
      .with(P.number, (v) => v)
      .otherwise(() => defaults.concurrency),
    deep: match(params.deep)
      .with(P.number, (v) => v)
      .otherwise(() => defaults.deep),
    dot: match(params.dot)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.dot),
    extglob: match(params.extglob)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.extglob),
    followSymbolicLinks: match(params.followSymbolicLinks)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.followSymbolicLinks),
    globstar: match(params.globstar)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.globstar),
    markDirectories: match(params.markDirectories)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.markDirectories),
    objectMode: match(params.objectMode)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.objectMode),
    onlyDirectories: match(params.onlyDirectories)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.onlyDirectories),
    onlyFiles: match(params.onlyFiles)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.onlyFiles),
    stats: match(params.stats)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.stats),
    suppressErrors: match(params.suppressErrors)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.suppressErrors),
    throwErrorOnBrokenSymbolicLink: match(params.throwErrorOnBrokenSymbolicLink)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.throwErrorOnBrokenSymbolicLink),
    unique: match(params.unique)
      .with(P.boolean, (v) => v)
      .otherwise(() => defaults.unique),
  } satisfies GlobbyOptions;
  return structuredClone(opts);
};
