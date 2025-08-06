import {raf} from "../../google-aistudio/browser/utils.js";

export async function extractChat(ele = document.body) {
  const messages = [];

  // 0. 确保打开系统提示词
  const sysCardOpenBtn = ele.querySelector<HTMLButtonElement>(".flex.w-full.content-start.rounded-lg.hover\\:bg-secondary-subtle button");
  if (sysCardOpenBtn) {
    sysCardOpenBtn.click();
    await raf();
  }

  // 1. 系统提示词（单独结构）
  const sysCard = ele.querySelector(".flex.w-full.content-start.rounded-lg.flex-col.bg-secondary-subtle");
  if (sysCard) {
    const ta = sysCard.querySelector("textarea");
    const text = ta?.value.trim();
    if (text && text !== "Enter system message (Optional)") {
      messages.push({role: "system", text});
    }
  }

  // 2. 用户 / 助理对话
  ele.querySelectorAll('[class*="rounded-lg"]').forEach((card) => {
    const roleBtn = card.querySelector<HTMLButtonElement>('button[class*="uppercase"]');
    if (!roleBtn) return;
    const role = roleBtn.textContent?.trim().toLowerCase() ?? "";
    if (!["user", "assistant"].includes(role)) return;

    const textarea = card.querySelector("textarea");
    if (!textarea) return;
    const text = textarea.value.trim();
    if (text) messages.push({role, text});
  });

  return messages;
}
