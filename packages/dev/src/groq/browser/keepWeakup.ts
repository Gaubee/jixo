/**
 * keepWeakup()
 * 返回一个取消保持激活的函数
 * 用法：
 *   const off = await keepWeakup();   // 开始保持
 *   off();                            // 取消保持
 */
export async function keepWeakup() {
  // 1.用 Worker 做心跳
  const workerCode = `
    setInterval(() => self.postMessage('tick'), 1000);
  `;
  const worker = new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));
  worker.onmessage = () => {};

  // 2. 播放一个 200 ms 的白噪声片段，音量很小但非 0
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const length = ctx.sampleRate * 0.2; // 200 ms
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 0.02 - 0.01; // 极小声

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(ctx.destination);
  source.start();

  // 3. 返回关闭函数
  return () => {
    worker.terminate();
    try { source.stop(); } catch {}
    try { ctx.close(); } catch {}
  };
}