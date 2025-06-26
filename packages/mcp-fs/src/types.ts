/**
 * Defines the access permissions for a mount point.
 * - R: Read-only
 * - W: Write-only
 * - RW: Read-write
 */
export type Permissions = Readonly<{flag: "R" | "W" | "RW"; read: boolean; write: boolean}>;
export const readwritePermissions = {
  flag: "RW",
  read: true,
  write: true,
} as const satisfies Permissions;
export const readOnlyPermissions = {
  flag: "R",
  read: true,
  write: false,
} as const satisfies Permissions;

/**
 * Represents a single mounted directory with its associated drive letter and permissions.
 */
export type MountPoint = {
  /** The original path string provided by the user. */
  rawPath: string;
  /** The absolute, resolved real path of the directory. */
  realPath: string;
  /** The assigned drive letter (e.g., 'A', 'B', 'C'). */
  drive?: string;
  /** The permissions for this mount point. */
  permissions: Permissions;
};

/**
 * Represents the entire state of the filesystem server.
 */
export type ServerState = {
  /** A list of all configured mount points. */
  mountPoints: MountPoint[];
  /** The current working directory for resolving relative paths. */
  cwd: string;
};
