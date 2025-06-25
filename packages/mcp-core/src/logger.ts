import {func_remember, obj_lazy_builder} from "@gaubee/util";
import {Console} from "node:console";
import {createWriteStream, mkdirSync} from "node:fs";
import path from "node:path";
const setEnable = (file: string | false, baseDir?: string) => {
  if (file) {
    baseDir ??= path.join(process.cwd(), ".jixo/logs");
    const basefilepath = path.resolve(baseDir, file);
    // const errfilepath = basefilepath.replace(/\.log$/, ".err.log");
    getConsole(basefilepath, basefilepath);
  } else {
    getConsole.reset();
  }
};
const getConsole = func_remember((outfile: string, errfile: string) => {
  mkdirSync(path.dirname(outfile), {recursive: true});
  const outStream = createWriteStream(outfile, {flags: "a"});
  const errStream = createWriteStream(errfile, {flags: "a"});
  return new Console(outStream, errStream);
});

const noop = () => {};
export const logger = obj_lazy_builder(
  {} as Console & {
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
