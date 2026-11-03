function readString(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw ? raw : fallback;
}

function readInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, got "${raw}".`);
  }
  return value;
}

function readList(name: string, fallback: string[]): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];

function readLogLevel(): string {
  const level = readString("NIGHTPAWS_LOG_LEVEL", "info");
  if (!logLevels.includes(level)) throw new Error(`NIGHTPAWS_LOG_LEVEL must be one of ${logLevels.join(", ")}.`);
  return level;
}

export const serverConfig = {
  host: readString("NIGHTPAWS_HOST", "127.0.0.1"),
  port: readInteger("NIGHTPAWS_PORT", 8787, 1, 65535),
  logLevel: readLogLevel(),
  databaseUrl: readString("NIGHTPAWS_DATABASE_URL", "postgres://nightpaws:nightpaws@127.0.0.1:5432/nightpaws"),
  databasePoolSize: readInteger("NIGHTPAWS_DATABASE_POOL_SIZE", 10, 1, 200),
  redisUrl: readString("NIGHTPAWS_REDIS_URL", "redis://127.0.0.1:6379"),
  trustProxy: readList("NIGHTPAWS_TRUST_PROXY", ["loopback"]),
  allowedOrigins: readList("NIGHTPAWS_ALLOWED_ORIGINS", []),
  rooms: {
    capacity: readInteger("NIGHTPAWS_ROOM_CAPACITY", 50, 1, 5000),
    maxQueue: readInteger("NIGHTPAWS_ROOM_MAX_QUEUE", 500, 0, 100000),
    tickMs: readInteger("NIGHTPAWS_ROOM_TICK_MS", 100, 33, 1000),
    resumeGraceMs: readInteger("NIGHTPAWS_ROOM_RESUME_GRACE_MS", 20000, 0, 300000),
    leaseMs: readInteger("NIGHTPAWS_ROOM_LEASE_MS", 30000, 5000, 600000),
  },
  realtime: {
    maxConnections: readInteger("NIGHTPAWS_WS_MAX_CONNECTIONS", 2000, 1, 1000000),
    maxConnectionsPerIp: readInteger("NIGHTPAWS_WS_MAX_CONNECTIONS_PER_IP", 8, 1, 10000),
    connectsPerMinutePerIp: readInteger("NIGHTPAWS_WS_CONNECTS_PER_MINUTE_PER_IP", 30, 1, 100000),
    maxPayloadBytes: readInteger("NIGHTPAWS_WS_MAX_PAYLOAD_BYTES", 1024, 128, 1048576),
    messagesPerSecond: readInteger("NIGHTPAWS_WS_MESSAGES_PER_SECOND", 25, 1, 10000),
    messageBurst: readInteger("NIGHTPAWS_WS_MESSAGE_BURST", 50, 1, 100000),
    posesPerSecond: readInteger("NIGHTPAWS_WS_POSES_PER_SECOND", 15, 1, 1000),
    violationsBeforeKick: readInteger("NIGHTPAWS_WS_VIOLATIONS_BEFORE_KICK", 60, 1, 100000),
    handshakeTimeoutMs: readInteger("NIGHTPAWS_WS_HANDSHAKE_TIMEOUT_MS", 5000, 500, 120000),
    idleTimeoutMs: readInteger("NIGHTPAWS_WS_IDLE_TIMEOUT_MS", 90000, 5000, 3600000),
    heartbeatMs: readInteger("NIGHTPAWS_WS_HEARTBEAT_MS", 20000, 1000, 600000),
    maxBufferedBytes: readInteger("NIGHTPAWS_WS_MAX_BUFFERED_BYTES", 1048576, 16384, 67108864),
  },
  abuse: {
    strikesBeforeBan: readInteger("NIGHTPAWS_ABUSE_STRIKES_BEFORE_BAN", 3, 1, 1000),
    strikeWindowSeconds: readInteger("NIGHTPAWS_ABUSE_STRIKE_WINDOW_SECONDS", 600, 10, 86400),
    banSeconds: readInteger("NIGHTPAWS_ABUSE_BAN_SECONDS", 300, 1, 604800),
  },
  http: {
    requestsPerMinute: readInteger("NIGHTPAWS_HTTP_REQUESTS_PER_MINUTE", 300, 1, 1000000),
    musicRequestsPerMinute: readInteger("NIGHTPAWS_HTTP_MUSIC_REQUESTS_PER_MINUTE", 6, 1, 10000),
    playerSavesPerMinute: readInteger("NIGHTPAWS_HTTP_PLAYER_SAVES_PER_MINUTE", 20, 1, 10000),
    bodyLimitBytes: readInteger("NIGHTPAWS_HTTP_BODY_LIMIT_BYTES", 16384, 1024, 1048576),
  },
};

export type ServerConfig = typeof serverConfig;
