import {type JunRunOptions, junRunLogic} from "../commands/run.js";

export interface JunRunCliOptions extends Omit<JunRunOptions, "onStdout" | "onStderr" | "onOutput"> {
  json: boolean;
}
export const junRunLogicForCli = async (options: JunRunCliOptions) => {
  const {json} = options;

  if (json) {
    let allStdout = "";
    let allStderr = "";
    let allOutput = "";
    const result = await junRunLogic({
      ...options,
      onStdout: (data) => {
        allStdout += data;
        allOutput += data;
      },
      onStderr: (data) => {
        allStderr += data;
        allOutput += data;
      },
      onOutput: (data) => {
        allOutput += data;
      },
    });
    console.log(JSON.stringify({result, ...(options.mode === "cp" ? {stdout: allStdout, stderr: allStderr} : {output: allOutput})}));

    return result.exitCode;
  } else {
    const result = await junRunLogic({
      ...options,
      onStdout: (data) => process.stdout.write(data),
      onStderr: (data) => process.stderr.write(data),
      onOutput: (data) => process.stdout.write(data),
    });
    return result.exitCode;
  }
};
