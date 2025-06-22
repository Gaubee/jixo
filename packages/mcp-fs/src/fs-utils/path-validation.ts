import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {AccessDeniedError} from "../error.js";
import {config} from "./config.js";

/**
 * Expands home directory tilde `~` and normalizes the path.
 * @param filepath The path to expand.
 * @returns The expanded path.
 */
export const expandHome = (filepath: string): string => {
  return filepath.startsWith("~/") || filepath === "~" ? path.join(os.homedir(), filepath.slice(1)) : filepath;
};

/**
 * Validates if a given path is within the allowed directories, handling symbolic links and non-existent paths for creation.
 * @throws {AccessDeniedError} If the path is invalid or not allowed.
 * @returns {string} The validated and resolved absolute path.
 */
export function validatePath(requestedPath: string): string {
  const expandedPath = expandHome(requestedPath);
  const absolute = path.isAbsolute(expandedPath) ? path.resolve(expandedPath) : path.resolve(process.cwd(), expandedPath);
  const normalizedRequested = path.normalize(absolute);

  if (config.allowedDirectories.length > 0 && !config.allowedDirectories.some((dir) => normalizedRequested.startsWith(dir))) {
    throw new AccessDeniedError(`Access denied: Path '${absolute}' is outside the allowed directories.`);
  }

  try {
    const realPath = fs.realpathSync(normalizedRequested);
    // Path exists, double-check its real path for symlinks pointing outside the sandbox
    if (config.allowedDirectories.length > 0 && !config.allowedDirectories.some((dir) => realPath.startsWith(dir))) {
      throw new AccessDeniedError("Access denied: Symbolic link points to a location outside the allowed directories.");
    }
    return realPath;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // Path does not exist. This is okay for creation.
      // We must validate its intended parent directory is within the sandbox.
      let parentDir = path.dirname(normalizedRequested);
      let current = parentDir;

      // Traverse up to find the first existing ancestor.
      while (true) {
        try {
          const realParentDir = fs.realpathSync(current);
          // Found an existing ancestor. Check if it's in the sandbox.
          if (config.allowedDirectories.length > 0 && !config.allowedDirectories.some((dir) => realParentDir.startsWith(dir))) {
            throw new AccessDeniedError(`Access denied: Cannot create item in directory '${parentDir}' as it resolves outside the allowed sandbox.`);
          }
          // Ancestor is valid, so the target path is also valid for creation.
          return normalizedRequested;
        } catch (parentError: any) {
          if (parentError.code === "ENOENT") {
            const next = path.dirname(current);
            if (next === current) {
              // Reached the root and found nothing.
              // The initial check at the top covers this; if we are here, it's allowed.
              return normalizedRequested;
            }
            current = next;
          } else {
            throw parentError; // Different error while checking parent.
          }
        }
      }
    }
    throw error; // Other errors like EACCES.
  }
}
