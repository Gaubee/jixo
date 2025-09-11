import {defineBuildInFunctionCalls} from "../helper.js";
import * as askUser from "./askUser.function_call.js";
import * as logThought from "./logThought.function_call.js";
import * as proposePlan from "./proposePlan.function_call.js";
import * as shellCat from "./shellCat.function_call.js";
import * as shellHistory from "./shellHistory.function_call.js";
import * as shellKill from "./shellKill.function_call.js";
import * as shellList from "./shellList.function_call.js";
import * as shellRemove from "./shellRemove.function_call.js";
import * as shellRun from "./shellRun.function_call.js";
import * as shellStart from "./shellStart.function_call.js";
import * as submitChangeSet from "./submitChangeSet.function_call.js";
export const coderFunctionCallsMap = defineBuildInFunctionCalls("coder", [
  askUser,
  logThought,
  proposePlan,
  shellCat,
  shellHistory,
  shellKill,
  shellList,
  shellRemove,
  shellRun,
  shellStart,
  submitChangeSet,
]);
