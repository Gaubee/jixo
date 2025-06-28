import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {before, describe, test} from "node:test";
import {parseCliArgs} from "../cli-parser.js";
import {MountConflictError} from "../error.js";

const TEMP_DIR = path.resolve("./temp-cli-test");
const DIR_A = path.join(TEMP_DIR, "dirA");
const DIR_B = path.join(TEMP_DIR, "dirB");

describe("CLI Argument Parser", () => {
  before(() => {
    fs.rmSync(TEMP_DIR, {recursive: true, force: true});
    fs.mkdirSync(DIR_A, {recursive: true});
    fs.mkdirSync(DIR_B, {recursive: true});
  });

  test("should parse simple path with default permissions and drive", () => {
    const {mountPoints} = parseCliArgs([DIR_A]);
    assert.strictEqual(mountPoints.length, 1);
    const [mp] = mountPoints;
    assert.strictEqual(mp.realPath, DIR_A);
    assert.strictEqual(mp.permissions.flag, "RW");
    assert.strictEqual(mp.drive, "A");
  });

  test("should parse path with specified drive", () => {
    const {mountPoints} = parseCliArgs([`$C=${DIR_A}`]);
    assert.strictEqual(mountPoints.length, 1);
    const [mp] = mountPoints;
    assert.strictEqual(mp.drive, "C");
  });

  test("should parse path with specified read-only permission", () => {
    const {mountPoints} = parseCliArgs([`[R]=${DIR_A}`]);
    assert.strictEqual(mountPoints.length, 1);
    const [mp] = mountPoints;
    assert.strictEqual(mp.permissions.flag, "R");
    assert.strictEqual(mp.permissions.write, false);
  });

  test("should parse path with full syntax", () => {
    const {mountPoints} = parseCliArgs([`$D[RW]=${DIR_B}`]);
    assert.strictEqual(mountPoints.length, 1);
    const [mp] = mountPoints;
    assert.strictEqual(mp.drive, "D");
    assert.strictEqual(mp.permissions.flag, "RW");
    assert.strictEqual(mp.realPath, DIR_B);
  });

  test("should handle multiple arguments and assign incremental drives", () => {
    const {mountPoints} = parseCliArgs([DIR_A, `$Z=${DIR_B}`, DIR_B]);
    assert.strictEqual(mountPoints.length, 3);
    const mpA = mountPoints.find((mp) => mp.realPath === DIR_A);
    const mpZ = mountPoints.find((mp) => mp.drive === "Z");
    const mpB_auto = mountPoints.find((mp) => mp.realPath === DIR_B && mp.drive === "B");

    assert.ok(mpA && mpZ && mpB_auto, "All mount points should be parsed correctly");
    assert.strictEqual(mpA?.drive, "A");
  });

  test("should throw MountConflictError on drive letter conflict", () => {
    assert.throws(() => parseCliArgs([`$A=${DIR_A}`, `$A=${DIR_B}`]), MountConflictError);
  });

  test("should allow same path with different drive letters", () => {
    assert.doesNotThrow(() => parseCliArgs([`$A=${DIR_A}`, `$B=${DIR_A}`]));
  });
});
