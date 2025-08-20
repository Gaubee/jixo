import {expect, test} from "vitest";
import a from "../res/_internal/coder/structed_output.ts";
import b from "../res/_internal/coder/structred_output.json" with {type: "json"};

test("structed output", async () => {
  expect(a).toStrictEqual(b);
});
