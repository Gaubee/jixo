import {map_get_or_put} from "@gaubee/util";
import type * as ComlinkType from "comlink";
import {createEndpoint, expose, finalizer, proxy, proxyMarker, releaseProxy, transfer, windowEndpoint, wrap} from "comlink";

const wm = new WeakMap();
const comlink_clone = <T>(val: T): T => {
  if (val === null || (typeof val !== "object" && typeof val !== "function")) {
    return val;
  }
  return map_get_or_put(wm, val, () => {
    if (typeof val === "function") {
      const fn = val as Function;
      return async function (this: any) {
        return comlink_clone(await fn.apply(this, arguments));
      } as T;
    }
    return transfer(val, []);
  });
};

export const Comlink = {
  expose,
  wrap,
  transfer,
  proxy,
  windowEndpoint,
  proxyMarker,
  createEndpoint,
  releaseProxy,
  finalizer,
  clone: comlink_clone,
};
export namespace Comlink {
  export type Remote<T> = ComlinkType.Remote<T>;
  export type Endpoint = ComlinkType.Endpoint;
}
