import type { Redis } from "ioredis";
import { LuaScript } from "../redis/lua-script.ts";

const purge = `
local function purge(members, queue, qlease, now)
  redis.call('ZREMRANGEBYSCORE', members, '-inf', now)
  local expired = redis.call('ZRANGEBYSCORE', qlease, '-inf', now)
  for _, id in ipairs(expired) do
    redis.call('ZREM', queue, id)
    redis.call('ZREM', qlease, id)
  end
end
`;

const admitScript = new LuaScript(`${purge}
local sid = ARGV[1]
local now = tonumber(ARGV[2])
local lease = tonumber(ARGV[3])
local capacity = tonumber(ARGV[4])
local maxQueue = tonumber(ARGV[5])
purge(KEYS[1], KEYS[2], KEYS[3], now)
if redis.call('ZSCORE', KEYS[1], sid) then
  redis.call('ZADD', KEYS[1], now + lease, sid)
  return {1, 0}
end
local rank = redis.call('ZRANK', KEYS[2], sid)
if rank then
  redis.call('ZADD', KEYS[3], now + lease, sid)
  return {0, rank + 1}
end
local inside = redis.call('ZCARD', KEYS[1])
local waiting = redis.call('ZCARD', KEYS[2])
if waiting == 0 and inside < capacity then
  redis.call('ZADD', KEYS[1], now + lease, sid)
  return {1, 0}
end
if waiting >= maxQueue then
  return {-1, waiting}
end
local ticket = redis.call('INCR', KEYS[4])
redis.call('ZADD', KEYS[2], ticket, sid)
redis.call('ZADD', KEYS[3], now + lease, sid)
return {0, waiting + 1}
`);

const promoteScript = new LuaScript(`${purge}
local now = tonumber(ARGV[1])
local lease = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
purge(KEYS[1], KEYS[2], KEYS[3], now)
local admitted = {}
local free = capacity - redis.call('ZCARD', KEYS[1])
while free > 0 do
  local head = redis.call('ZPOPMIN', KEYS[2])
  if #head == 0 then break end
  local sid = head[1]
  redis.call('ZREM', KEYS[3], sid)
  redis.call('ZADD', KEYS[1], now + lease, sid)
  table.insert(admitted, sid)
  free = free - 1
end
return admitted
`);

const leaveScript = new LuaScript(`
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('DEL', KEYS[4])
return 1
`);

const holdScript = new LuaScript(`
local sid = ARGV[1]
local now = tonumber(ARGV[2])
local grace = tonumber(ARGV[3])
if not redis.call('ZSCORE', KEYS[1], sid) then return 0 end
redis.call('ZADD', KEYS[1], 'XX', now + grace, sid)
redis.call('SET', KEYS[2], ARGV[4], 'PX', grace)
return 1
`);

const resumeScript = new LuaScript(`
local sid = ARGV[1]
local now = tonumber(ARGV[3])
local lease = tonumber(ARGV[4])
local stored = redis.call('GET', KEYS[2])
if not stored or stored ~= ARGV[2] then return 0 end
local score = redis.call('ZSCORE', KEYS[1], sid)
if not score or tonumber(score) < now then return 0 end
redis.call('DEL', KEYS[2])
redis.call('ZADD', KEYS[1], now + lease, sid)
return 1
`);

const refreshScript = new LuaScript(`
local now = tonumber(ARGV[1])
local lease = tonumber(ARGV[2])
local memberCount = tonumber(ARGV[3])
local requeued = {}
for index = 4, 3 + memberCount do
  redis.call('ZADD', KEYS[1], now + lease, ARGV[index])
end
for index = 4 + memberCount, #ARGV do
  local sid = ARGV[index]
  if not redis.call('ZSCORE', KEYS[1], sid) then
    if not redis.call('ZSCORE', KEYS[2], sid) then
      local ticket = redis.call('INCR', KEYS[4])
      redis.call('ZADD', KEYS[2], ticket, sid)
      table.insert(requeued, sid)
    end
    redis.call('ZADD', KEYS[3], now + lease, sid)
  end
end
return requeued
`);

export type AdmitResult = { kind: "admitted" } | { kind: "queued"; position: number } | { kind: "queue-full" };

export interface QueueStanding {
  admitted: boolean;
  position: number | null;
}

export interface MembershipSettings {
  capacity: number;
  maxQueue: number;
  leaseMs: number;
}

export class RoomMembership {
  private readonly members: string;
  private readonly queue: string;
  private readonly queueLeases: string;
  private readonly tickets: string;

  constructor(
    private readonly redis: Redis,
    private readonly roomId: string,
    private readonly settings: MembershipSettings,
  ) {
    const tag = `np:room:{${roomId}}`;
    this.members = `${tag}:members`;
    this.queue = `${tag}:queue`;
    this.queueLeases = `${tag}:queue-leases`;
    this.tickets = `${tag}:tickets`;
  }

  get capacity(): number {
    return this.settings.capacity;
  }

  private resumeKey(sessionId: string): string {
    return `np:room:{${this.roomId}}:resume:${sessionId}`;
  }

  async admit(sessionId: string): Promise<AdmitResult> {
    const { capacity, maxQueue, leaseMs } = this.settings;
    const [status, position] = (await admitScript.run(
      this.redis,
      [this.members, this.queue, this.queueLeases, this.tickets],
      [sessionId, Date.now(), leaseMs, capacity, maxQueue],
    )) as [number, number];
    if (status === 1) return { kind: "admitted" };
    if (status === 0) return { kind: "queued", position };
    return { kind: "queue-full" };
  }

  async promote(): Promise<string[]> {
    const { capacity, leaseMs } = this.settings;
    return (await promoteScript.run(this.redis, [this.members, this.queue, this.queueLeases], [Date.now(), leaseMs, capacity])) as string[];
  }

  async leave(sessionId: string): Promise<void> {
    await leaveScript.run(this.redis, [this.members, this.queue, this.queueLeases, this.resumeKey(sessionId)], [sessionId]);
  }

  async hold(sessionId: string, token: string, graceMs: number): Promise<boolean> {
    if (graceMs <= 0) {
      await this.leave(sessionId);
      return false;
    }
    const held = await holdScript.run(this.redis, [this.members, this.resumeKey(sessionId)], [sessionId, Date.now(), graceMs, token]);
    return held === 1;
  }

  async resume(sessionId: string, token: string): Promise<boolean> {
    const resumed = await resumeScript.run(
      this.redis,
      [this.members, this.resumeKey(sessionId)],
      [sessionId, token, Date.now(), this.settings.leaseMs],
    );
    return resumed === 1;
  }

  async refresh(memberIds: string[], queuedIds: string[]): Promise<string[]> {
    if (!memberIds.length && !queuedIds.length) return [];
    return (await refreshScript.run(
      this.redis,
      [this.members, this.queue, this.queueLeases, this.tickets],
      [Date.now(), this.settings.leaseMs, memberIds.length, ...memberIds, ...queuedIds],
    )) as string[];
  }

  async standings(queuedIds: string[]): Promise<{ standings: Map<string, QueueStanding>; inside: number; waiting: number }> {
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(this.members, "-inf", Date.now());
    pipeline.zcard(this.members);
    pipeline.zcard(this.queue);
    for (const id of queuedIds) {
      pipeline.zrank(this.queue, id);
      pipeline.zscore(this.members, id);
    }
    const results = (await pipeline.exec()) ?? [];
    const failure = results.find(([error]) => error);
    if (failure?.[0]) throw failure[0];
    const value = (index: number) => results[index]?.[1];
    const standings = new Map<string, QueueStanding>();
    queuedIds.forEach((id, index) => {
      const rank = value(3 + index * 2) as number | null;
      const score = value(4 + index * 2) as string | null;
      standings.set(id, { admitted: score !== null, position: rank === null ? null : rank + 1 });
    });
    return { standings, inside: Number(value(1) ?? 0), waiting: Number(value(2) ?? 0) };
  }
}
