import { forward, isMessagePort, createEndpoint } from "./adapter.ts";

const portCallbacks = new Map<string, ((port: chrome.runtime.Port) => void)[]>();
const ports = new Map<string, chrome.runtime.Port>();

async function serializePort(id: string) {
  if (!portCallbacks.has(id)) {
    portCallbacks.set(id, []);
  }
  const callbacks = portCallbacks.get(id)!;
  return new Promise<chrome.runtime.Port>((resolve) => {
    callbacks.push((port) => resolve(port));
  });
}

function deserializePort(id: string) {
  const port = ports.get(id)!;
  const { port1, port2 } = new MessageChannel();
  forward(port2, port, serializePort, deserializePort);
  return port1;
}

chrome.runtime.onConnect.addListener((port) => {
  if (!isMessagePort(port)) return;
  ports.set(port.name, port);
  portCallbacks.get(port.name)?.forEach((cb) => cb(port));
});

export function createBackgroundEndpoint(port: chrome.runtime.Port) {
  return createEndpoint(port, serializePort, deserializePort);
}