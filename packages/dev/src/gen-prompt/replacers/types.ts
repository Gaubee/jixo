import type {PathResolver} from "@gaubee/nodekit";

export interface ReplacerOptions {
  globOrFilepath: string;
  mode: string;
  params: Record<string, unknown>;
  once: boolean;
  rootResolver: PathResolver;
  baseDir: string;
}

export interface Replacer {
  (options: ReplacerOptions): Promise<string>;
}
