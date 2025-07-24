import {func_remember} from "@gaubee/util";
import {myDoctorConfig} from "./config.js";
import {runDoctor} from "./doctor.js";

export const doctor = func_remember(async (enableLog: boolean = true) => {
  const report = await runDoctor(myDoctorConfig, enableLog);
  return report;
});
