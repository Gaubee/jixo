import fs from "node:fs";
import path from "node:path";
import {MountConflictError} from "./error.js";
import {expandHome} from "./fs-utils/resolve-and-validate-path.js";
import {readwritePermissions, type MountPoint, type Permissions} from "./types.js";

const ARG_PATTERN = /^(?:(?:\$([A-Z]+))?(?:\[([^\[\]]*)\])?)?(?:=)?(.+)$/;

/**
 * 使用URLSearchParams的标准来做解析
 *
 * 未来可以在这里做更多的扩展，比如限制允许使用的接口、限制使用频率、限制使用次数、限制文件大小、过滤文件后缀 等等
 * @param p
 * @returns
 */
function normalizePermissions(p: string) {
  const params = new URLSearchParams(p);
  const readwrite = params.has("RW") || params.has("rw");
  const read = readwrite || params.has("R") || params.has("r");
  const write = readwrite || params.has("W") || params.has("w");
  const permissions = {
    flag: (read ? "R" : "") + (write ? "W" : ""),
    read,
    write,
  } as Permissions;
  return permissions;
}

export function parseCliArgs(mountArgs: string[]): {mountPoints: MountPoint[]; readOnly: boolean} {
  const mountPoints: MountPoint[] = [];
  const usedDrives = new Map<string, string>(); // drive letter -> realPath
  let nextDriveCode = "A".charCodeAt(0);

  for (const arg of mountArgs) {
    const match = arg.match(ARG_PATTERN);
    if (!match) continue; // Should not happen, as yargs provides the args

    let [, drive, permissions, rawPath] = match;

    const expandedPath = expandHome(rawPath);
    const realPath = fs.realpathSync(path.resolve(expandedPath));

    if (drive) {
      if (usedDrives.has(drive) && usedDrives.get(drive) !== realPath) {
        throw new MountConflictError(`Drive letter '$${drive}' is assigned to multiple different paths: '${usedDrives.get(drive)}' and '${realPath}'.`);
      }
      usedDrives.set(drive, realPath);
    } else {
      drive = String.fromCharCode(nextDriveCode++);
      while (usedDrives.has(drive)) {
        drive = String.fromCharCode(nextDriveCode++);
      }
      usedDrives.set(drive, realPath);
    }

    const finalPermissions = permissions ? normalizePermissions(permissions) : readwritePermissions;

    mountPoints.push({
      drive,
      rawPath,
      realPath,
      permissions: finalPermissions,
    });
  }

  // Sort by path length descending to ensure more specific paths are checked first
  mountPoints.sort((a, b) => b.realPath.length - a.realPath.length);

  // Simple read-only check (global override will be handled in index.ts)
  const isReadOnly = mountPoints.every((mp) => mp.permissions.flag === "R");

  return {mountPoints, readOnly: isReadOnly};
}
