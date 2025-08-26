export interface JunTask {
  pid: number;
  osPid?: number; // Real OS PID for killing
  command: string;
  args: string[];
  env?: Record<string, string>;
  startTime: string;
  endTime?: string;
  status: "running" | "completed" | "error" | "killed";
}

export type StdioLogEntry = {
  type: "stdout" | "stderr" | "stdin";
  content: string;
  time: string;
};

export interface JunTaskLog extends JunTask {
  stdio: Array<StdioLogEntry>;
}

// JIXO_CODER_EOF
