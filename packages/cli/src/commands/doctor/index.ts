// import {bgGreen, bgRed, black, white} from "@gaubee/nodekit"; // For the final message
import {func_remember} from "@gaubee/util";
import {myDoctorConfig} from "./config.js";
import {runDoctor} from "./doctor.js";

export const doctor = func_remember(async (log = true) => {
  const report = await runDoctor(myDoctorConfig, log ? undefined : {write: (_log) => {}});

  //   if (log) {
  //     console.log("\n\n--- Structured Report (for programmatic use) ---");
  //     console.log(JSON.stringify(report, null, 2));

  //     if (!report.overallSuccess) {
  //       console.error(bgRed(white("\nCritical environment checks failed. Please fix the issues above before proceeding.")));
  //       // process.exit(1); // Optionally exit if critical checks fail in a real CLI
  //     } else {
  //       console.log(bgGreen(black("\nAll critical checks passed successfully!")));
  //     }
  //   }
  return report;
});
