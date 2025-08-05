import {func_remember} from "@gaubee/util";

export const getWindowId = func_remember((): string => {
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.endsWith("_window_id")) {
      try {
        return JSON.parse(sessionStorage.getItem(key)!);
      } catch {}
    }
  }
  const windowId = crypto.randomUUID();
  sessionStorage.setItem(`groq_2_jixo_window_id`, windowId);
  return windowId;
});
