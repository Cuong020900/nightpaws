import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import { LuaScript } from "../redis/lua-script.ts";

const windowCounterScript = new LuaScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return count
`);

const strikeScript = new LuaScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
if count >= tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[3])
  redis.call('DEL', KEYS[1])
  return 1
end
return 0
`);

export interface AbuseSettings {
  strikesBeforeBan: number;
  strikeWindowSeconds: number;
  banSeconds: number;
  maxConnections: number;
  maxConnectionsPerIp: number;
  connectsPerMinutePerIp: number;
}

export type OpenResult = "ok" | "ip-limit" | "server-full";

interface CachedBan {
  banned: boolean;
  until: number;
}

const banCacheLimit = 50000;
const cleanCacheMs = 2000;

export class AbuseGuard {
  private readonly banCache = new Map<string, CachedBan>();
  private readonly openPerIp = new Map<string, number>();
  private openTotal = 0;

  constructor(
    private readonly redis: Redis,
    private readonly settings: AbuseSettings,
    private readonly log: FastifyBaseLogger,
  ) {}

  get openConnections(): number {
    return this.openTotal;
  }

  async isBanned(ip: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.banCache.get(ip);
    if (cached && cached.until > now) return cached.banned;
    try {
      const ttl = await this.redis.pttl(`np:abuse:ban:${ip}`);
      const banned = ttl > 0 || ttl === -1;
      this.remember(ip, banned, now + (banned && ttl > 0 ? ttl : cleanCacheMs));
      return banned;
    } catch (error) {
      this.log.warn({ err: error }, "ban lookup failed; allowing request");
      return false;
    }
  }

  tryOpen(ip: string): OpenResult {
    if (this.openTotal >= this.settings.maxConnections) return "server-full";
    const current = this.openPerIp.get(ip) ?? 0;
    if (current >= this.settings.maxConnectionsPerIp) return "ip-limit";
    this.openPerIp.set(ip, current + 1);
    this.openTotal += 1;
    return "ok";
  }

  release(ip: string): void {
    const current = this.openPerIp.get(ip) ?? 0;
    if (current <= 0) return;
    if (current === 1) this.openPerIp.delete(ip);
    else this.openPerIp.set(ip, current - 1);
    this.openTotal -= 1;
  }

  async allowConnectAttempt(ip: string): Promise<boolean> {
    try {
      const count = Number(await windowCounterScript.run(this.redis, [`np:rl:ws-connect:${ip}`], [60000]));
      return count <= this.settings.connectsPerMinutePerIp;
    } catch (error) {
      this.log.warn({ err: error }, "connection rate check failed; allowing connection");
      return true;
    }
  }

  async strike(ip: string, reason: string): Promise<boolean> {
    try {
      const { strikeWindowSeconds, strikesBeforeBan, banSeconds } = this.settings;
      const banned =
        (await strikeScript.run(this.redis, [`np:abuse:strikes:${ip}`, `np:abuse:ban:${ip}`], [strikeWindowSeconds, strikesBeforeBan, banSeconds, reason])) === 1;
      if (banned) {
        this.remember(ip, true, Date.now() + banSeconds * 1000);
        this.log.warn({ ip, reason, banSeconds }, "client banned for repeated abuse");
      } else {
        this.log.warn({ ip, reason }, "abuse strike recorded");
      }
      return banned;
    } catch (error) {
      this.log.warn({ err: error, ip, reason }, "could not record abuse strike");
      return false;
    }
  }

  private remember(ip: string, banned: boolean, until: number): void {
    if (this.banCache.size >= banCacheLimit) this.banCache.clear();
    this.banCache.set(ip, { banned, until });
  }
}
