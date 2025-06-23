import {func_remember, obj_lazy_builder} from "@gaubee/util";
import {Console} from "node:console";
import {createWriteStream} from "node:fs";
import path from "node:path";
const setEnable = (file: string | false) => {
  if (file) {
    getConsole(file);
  } else {
    getConsole.reset();
  }
};
const getConsole = func_remember(
  (logfile: string) => {
    const logStream = createWriteStream(logfile, {flags: "a"});
    const errStream = createWriteStream(logfile, {flags: "a"});

    return new Console(logStream, errStream);
  },
  (logfile: string) => {
    return path.resolve(process.cwd(), logfile);
  },
);

const noop = () => {};
export const logger = obj_lazy_builder(
  console as Console & {
    setEnable: typeof setEnable;
  },
  (_, p) => {
    if (p === "setEnable") {
      return setEnable;
    }
    if (p === "Console") {
      return Console;
    }
    if (getConsole.returnValue) {
      const log = getConsole.returnValue as any;
      return log[p];
    }
    return noop as any;
  },
);
