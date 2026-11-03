import { createHash } from "node:crypto";
import type { Redis } from "ioredis";

export class LuaScript {
  private readonly sha: string;

  constructor(private readonly source: string) {
    this.sha = createHash("sha1").update(source).digest("hex");
  }

  async run(redis: Redis, keys: string[], args: (string | number)[]): Promise<unknown> {
    try {
      return await redis.evalsha(this.sha, keys.length, ...keys, ...args);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("NOSCRIPT")) throw error;
      return redis.eval(this.source, keys.length, ...keys, ...args);
    }
  }
}
