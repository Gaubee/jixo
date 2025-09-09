import {type JunStartOptions, junStartLogic} from "../commands/start.js";

export interface JunStartCliOptions extends Omit<JunStartOptions, "onStdout" | "onStderr" | "onOutput"> {
  json: boolean;
}
export const junStartLogicForCli = async (options: JunStartCliOptions) => {
  const {json} = options;

  const result = await junStartLogic({
    ...options,
  });
  if (json) {
    console.log(JSON.stringify({result}));
  } else {
    console.log(`Task started, pid: ${result.pid}`);
  }
  return 0;
};
