import { ServiceWorkerMessage } from "../common/serviceWorkerMessages";

export async function sendMessage(message: ServiceWorkerMessage): Promise<void> {
  const clients = await (self as any as ServiceWorkerGlobalScope).clients.matchAll();

  clients.forEach((client) => {
    client.postMessage(message);
  });
}
