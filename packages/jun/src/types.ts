export type JunTaskOutput = "raw" | "text" | "html";

export interface JunTask {
  pid: number;
  osPid?: number; // Real OS PID for killing
  command: string;
  args: string[];
  env?: Record<string, string>;
  startTime: string;
  endTime?: string;
  status: "running" | "completed" | "error" | "killed";
  output?: JunTaskOutput;
  mode: "tty" | "cp";
}

export type StdioLogEntry = {
  type: "output" | "stdout" | "stderr" | "stdin";
  content: string;
  time: string;
};

export interface JunTaskLog extends JunTask {
  stdio: Array<StdioLogEntry>;
}
