/**
 * keepWeakup()
 * 返回一个取消保持激活的函数
 * 用法：
 *   const off = await keepWeakup();   // 开始保持
 *   off();                            // 取消保持
 */
export async function keepWeakup() {
  // 1. Web-Worker 里跑定时器，Chrome 不会对它做后台节流
  const workerCode = `
    let counter = 0;
    setInterval(() => {
      // 每 1 秒发一次消息，防止 Worker 被挂起
      self.postMessage(++counter);
    }, 1000);
  `;
  const blob = new Blob([workerCode], {type: "application/javascript"});
  const worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = () => {}; // 只要接收即可，防止报错

  // 2. 打开一个「静音」AudioContext，让标签页被认为在播放音频
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buf = ctx.createBuffer(1, 1, 22050); // 1 帧静音
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.loop = true;
  node.connect(ctx.destination);
  node.start();

  // 3. 返回一个一次性关闭函数
  return () => {
    worker.terminate();
    try {
      node.stop();
    } catch {}
    try {
      ctx.close();
    } catch {}
  };
}
