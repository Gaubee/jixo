import type {PathResolver} from "@gaubee/nodekit";

export interface ReplacerOptions {
  codeName: string;
  globOrFilepath: string;
  mode: string;
  params: Record<string, unknown>;
  rootResolver: PathResolver;
  baseDir: string;
}

export interface Replacer {
  (options: ReplacerOptions): Promise<string>;
}
