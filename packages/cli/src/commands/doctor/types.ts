// types.ts (or directly in your doctor.ts)

export interface ToolCheckConfig {
  /** A unique identifier for this check (e.g., 'pnpm', 'uvx-cli') */
  id: string;

  /** User-friendly name for display purposes (e.g., "PNPM Package Manager") */
  displayName: string;

  /** The command to execute to get the version (e.g., "pnpm --version") */
  versionCommand: string;

  /**
   * A regular expression to parse the version string from the command's output.
   * It MUST have at least one capturing group, which should capture the version string.
   * Example: For "pnpm 10.11.0", regex could be /pnpm\s+([\d.]+)/ or simply /([\d.]+)/
   */
  versionParseRegex: RegExp;

  /**
   * The minimum required version (Semantic Versioning string).
   * If undefined, only existence is checked.
   */
  minVersion?: string;

  /**
   * Optional: A hint or URL for installation if the tool is missing or version is too low.
   */
  installationHint?: string;

  /**
   * Optional: If true, a failure for this tool won't cause the overall doctor check to fail.
   * It will still be reported. Defaults to false.
   */
  optional?: boolean;
}

export type DoctorConfig = ToolCheckConfig[];
