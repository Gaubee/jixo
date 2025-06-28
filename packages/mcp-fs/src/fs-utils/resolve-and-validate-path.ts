import os from "node:os";
import path from "node:path";
import {PathNotMountedError, PermissionDeniedError} from "../error.js";
import {state} from "../state.js";
import type {MountPoint} from "../types.js";

/**
 * Expands home directory tilde `~` and normalizes the path.
 * @param filepath The path to expand.
 * @returns The expanded path.
 */
export const expandHome = (filepath: string): string => {
  return filepath.startsWith("~/") || filepath === "~" ? path.join(os.homedir(), filepath.slice(1)) : filepath;
};

function findMountPoint(absolutePath: string): MountPoint | undefined {
  // state.mountPoints is pre-sorted by path length, descending.
  // The first match is the most specific one.
  return state.mountPoints.find((mp) => absolutePath.startsWith(mp.realPath));
}

/**
 * Resolves a user-provided path to an absolute, real path and validates it against mount points and permissions.
 * This is the single source of truth for all path operations.
 *
 * @param rawPath The path from the tool arguments (can be relative, absolute, or use drive letters).
 * @param requiredPermission The required permission ('read' or 'write') for the operation.
 * @returns An object containing the resolved absolute path and its corresponding mount point.
 * @throws {PathNotMountedError} If the path does not fall within any mounted directory.
 * @throws {PermissionDeniedError} If the operation is not allowed by the mount point's permissions.
 */
export function resolveAndValidatePath(
  rawPath: string,
  requiredPermission: "read" | "write",
): {
  validatedPath: string;
  mountPoint: MountPoint;
} {
  let absolutePath: string;
  const expandedPath = expandHome(rawPath);

  // 1. Resolve path to absolute
  if (expandedPath.startsWith("$")) {
    const driveMatch = expandedPath.match(/^\$([A-Z]+)/);
    if (driveMatch) {
      const driveLetter = driveMatch[1];
      const mount = state.mountPoints.find((mp) => mp.drive === driveLetter);
      if (!mount) {
        throw new PathNotMountedError(`Drive '$${driveLetter}' is not defined. Use 'fs_list_mounts' to see available drives.`);
      }
      const restOfPath = expandedPath.substring(driveMatch.length);
      absolutePath = path.join(mount.realPath, restOfPath);
    } else {
      throw new PathNotMountedError(`Invalid drive format in path: '${rawPath}'`);
    }
  } else if (path.isAbsolute(expandedPath)) {
    absolutePath = expandedPath;
  } else {
    absolutePath = path.join(state.cwd, expandedPath);
  }

  const normalizedPath = path.normalize(absolutePath);

  // 2. Find the governing mount point
  const mountPoint = findMountPoint(normalizedPath);
  if (!mountPoint) {
    if (state.mountPoints.length > 0) {
      throw new PathNotMountedError(`Path '${rawPath}' (resolves to '${normalizedPath}') is not within any mounted directory.`);
    }
    // If no mounts, allow access but with caution.
    // This logic might be tightened in the future.
    return {validatedPath: normalizedPath, mountPoint: {rawPath: "", realPath: "", permissions: {flag: "RW", read: true, write: true}}};
  }

  // 3. Check permissions
  if (requiredPermission === "read" && !mountPoint.permissions.read) {
    throw new PermissionDeniedError(`Read access to '${rawPath}' is denied. Mount point '${mountPoint.rawPath}' is write-only.`);
  }
  if (requiredPermission === "write" && !mountPoint.permissions.write) {
    throw new PermissionDeniedError(`Write access to '${rawPath}' is denied. Mount point '${mountPoint.rawPath}' is read-only.`);
  }

  // 4. Return the validated, normalized path.
  // We don't use fs.realpathSync here for creation paths (e.g. write_file).
  // The realpath of the parent is implicitly checked by the mount point logic.
  return {validatedPath: normalizedPath, mountPoint};
}
