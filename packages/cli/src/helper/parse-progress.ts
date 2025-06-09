import {math_clamp} from "@gaubee/util";

export const parseProgress = (p: unknown) => {
  let progress = 0;
  switch (typeof p) {
    case "number": {
      progress = p;
      break;
    }
    case "string": {
      const p_str = p.trim();
      if (p_str.endsWith("%")) {
        progress = +p_str.slice(0, -1) / 100;
      } else {
        progress = +p_str;
      }
      break;
    }
  }
  if (Number.isFinite(progress)) {
    progress = math_clamp(progress, 0, 1);
  } else {
    progress = 0;
  }
  return progress;
};
