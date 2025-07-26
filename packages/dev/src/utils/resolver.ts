import {createResolver, createResolverByRootFile} from "@gaubee/node";

export const projectResolver = createResolverByRootFile(import.meta.url, "package.json");
export const defaultAssetsResolver = createResolver(projectResolver("assets"));
export let assetsResolver = defaultAssetsResolver;
export const setAssetsResolver = (dir?: string) => {
  return (assetsResolver = dir ? createResolver(dir) : defaultAssetsResolver);
};
