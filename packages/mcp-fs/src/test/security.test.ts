import assert from "node:assert";
import {describe, test} from "vitest";
import {readonlyTools, readwriteTools} from "../server.js";

describe("MCP Filesystem Tools - Security", () => {
  const sortKeys = (keys: string[]) => keys.sort((a, b) => a.localeCompare(b));

  const readOnlyToolNames = sortKeys(["read_file", "list_directory", "get_file_info", "search_files", "list_allowed_directories", "get_cwd", "list_mounts"]);
  const writeToolNames = sortKeys(["write_file", "edit_file", "create_directory", "delete_path", "move_file", "copy_path", "set_cwd"]);
  const allToolNames = sortKeys([...readOnlyToolNames, ...writeToolNames]);

  test("Read-only server should only contain read-only tools", () => {
    const registeredTools = sortKeys(Object.keys(readonlyTools));
    assert.deepStrictEqual(registeredTools, readOnlyToolNames);
  });

  test("Read-write server should contain all tools", () => {
    const registeredTools = sortKeys(Object.keys(readwriteTools));
    assert.deepStrictEqual(registeredTools, allToolNames);
  });
});
