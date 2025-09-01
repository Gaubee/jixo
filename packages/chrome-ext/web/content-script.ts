(async () => {
  const src = chrome.runtime.getURL("web.js");
  await import(src);
})();
