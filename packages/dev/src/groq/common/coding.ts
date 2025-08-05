import type {JsonLike} from "../fs-duplex/json.js";
import {superjson as s} from "../fs-duplex/superjson.js";

/**
 * @deprecated The superjson instance is now managed in `fs-duplex/superjson.ts`.
 * Import from there if you need the instance, or import the `JsonLike` object.
 */
export const superjson: JsonLike = s;
