import type {Config} from "@mastra/core";
type MiddlewareOrArr = NonNullable<NonNullable<Config["server"]>["middleware"]>;
type Unpack<T> = T extends (infer U)[] ? U : T;

export type Middleware = Unpack<MiddlewareOrArr>;
