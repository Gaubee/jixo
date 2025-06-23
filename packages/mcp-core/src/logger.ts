import {func_remember, obj_lazy_builder} from "@gaubee/util";
import {Console} from "node:console";
import {createWriteStream, mkdirSync} from "node:fs";
import path from "node:path";
const setEnable = (file: string | false, baseDir?: string) => {
  if (file) {
    baseDir ??= path.join(process.cwd(), ".jixo/logs");
    const logfilepath = path.resolve(baseDir, file);
    getConsole(logfilepath);
  } else {
    getConsole.reset();
  }
};
const getConsole = func_remember((logfile: string) => {
  mkdirSync(path.dirname(logfile), {recursive: true});
  const logStream = createWriteStream(logfile, {flags: "a"});
  return new Console(logStream, logStream);
});

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
