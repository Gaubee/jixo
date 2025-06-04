import {spinner, writeJson} from "@gaubee/nodekit";

export const upgrade = async (dir: string, options: {mirrorUrl?: string}) => {
  // TODO 下载最新的提示词集合
  const mirrorUrl = options.mirrorUrl || "https://jixo.ai/jixo-prompts.json";
  const loading = spinner.default("Upgrading prompts");
  loading.start("Downloading...");
  //   await delay(1000);
  try {
    const prompts = await fetch(mirrorUrl).then((res) => res.json());
    loading.stopAndPersist({symbol: "✅", text: "Download completed"});
    writeJson(import.meta.resolve("jixo-prompts.json"), prompts);
  } catch (e) {
    loading.stopAndPersist({symbol: "❌", text: "Download failed"});
  }
};
