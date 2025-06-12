import {gray, red} from "@gaubee/nodekit";
import {AISDKError} from "ai";
import createDebug from "debug";

createDebug.formatters.y = (v) => {
  return JSON.stringify(v, (_k, v) => {
    if (typeof v === "string") {
      let slice_len = 0;
      if (v.length > 200) {
        slice_len = 50;
      }
      if (v.length > 100) {
        slice_len = 30;
      }
      if (slice_len > 0) {
        return `<string:${v.length}>${v.slice(0, slice_len)}${gray("...")}${v.slice(-slice_len)}`;
      }
      return v;
    }
    if (AISDKError.isInstance(v)) {
      return red(v.message);
    }
    return v;
  });
};
export {createDebug};
