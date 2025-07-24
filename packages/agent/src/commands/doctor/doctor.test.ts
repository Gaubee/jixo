// Example Usage (e.g., in an index.ts or app.ts)

import {myDoctorConfig} from "./config.js"; // Assuming config.ts
import {runDoctor} from "./doctor.js";

async function main() {
  await runDoctor(myDoctorConfig);
  //   console.log("\n\n--- Structured Report ---");
  //   console.log(JSON.stringify(report, null, 2));

  //   if (!report.overallSuccess) {
  //     console.error(bgRed(white("\nCritical environment checks failed. Please fix the issues above before proceeding.")));
  //     // process.exit(1); // Optionally exit if critical checks fail
  //   }
}

main().catch(console.error);
