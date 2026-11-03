import { Redis } from "ioredis";

export interface RedisClients {
  commands: Redis;
  subscriber: Redis;
  rateLimit: Redis;
}

function connect(url: string, name: string, options: { maxRetriesPerRequest: number; connectTimeout: number }): Redis {
  return new Redis(url, {
    connectionName: `nightpaws-${name}`,
    enableAutoPipelining: name === "commands",
    maxRetriesPerRequest: options.maxRetriesPerRequest,
    connectTimeout: options.connectTimeout,
    retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
  });
}

function waitUntilReady(client: Redis, timeoutMs: number): Promise<void> {
  if (client.status === "ready") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off("ready", onReady);
      reject(new Error(`Redis did not become ready within ${timeoutMs} ms.`));
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    client.once("ready", onReady);
  });
}

export async function createRedisClients(url: string, onError: (error: Error) => void): Promise<RedisClients> {
  const clients: RedisClients = {
    commands: connect(url, "commands", { maxRetriesPerRequest: 3, connectTimeout: 5000 }),
    subscriber: connect(url, "subscriber", { maxRetriesPerRequest: 3, connectTimeout: 5000 }),
    rateLimit: connect(url, "rate-limit", { maxRetriesPerRequest: 1, connectTimeout: 500 }),
  };
  for (const client of Object.values(clients)) client.on("error", onError);
  await Promise.all(Object.values(clients).map((client) => waitUntilReady(client, 60000)));
  return clients;
}

export async function closeRedisClients(clients: RedisClients): Promise<void> {
  await Promise.all(Object.values(clients).map((client) => client.quit().catch(() => client.disconnect())));
}
