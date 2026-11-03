import rateLimit from "@fastify/rate-limit";
import { apiRoutePatterns } from "@nightpaws/shared";
import Fastify, { LogController, type FastifyBaseLogger } from "fastify";
import { serverConfig } from "./config.ts";
import { createDatabase, migrateDatabase } from "./database.ts";
import { MusicRepository } from "./music/music-repository.ts";
import { registerMusicRoutes } from "./music/music-routes.ts";
import { MusicService } from "./music/music-service.ts";
import { PlayerRepository } from "./players/player-repository.ts";
import { registerPlayerRoutes } from "./players/player-routes.ts";
import { RealtimeGateway } from "./realtime/realtime-gateway.ts";
import { RoomBus } from "./realtime/room-bus.ts";
import { RoomDirectory } from "./realtime/room-directory.ts";
import { closeRedisClients, createRedisClients } from "./redis/redis-clients.ts";
import { AbuseGuard } from "./security/abuse-guard.ts";
import { clientKey, compileTrustProxy } from "./security/client-address.ts";

async function waitFor(name: string, probe: () => Promise<unknown>, log: FastifyBaseLogger): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await probe();
      return;
    } catch (error) {
      if (attempt >= 60) throw error;
      if (attempt === 1 || attempt % 10 === 0) log.warn({ err: error, attempt }, `waiting for ${name}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

function throttledErrorLogger(log: FastifyBaseLogger, label: string): (error: Error) => void {
  let lastAt = 0;
  return (error) => {
    const now = Date.now();
    if (now - lastAt < 5000) return;
    lastAt = now;
    log.error({ err: error }, label);
  };
}

const trust = compileTrustProxy(serverConfig.trustProxy);
const app = Fastify({
  logger: { level: serverConfig.logLevel },
  logController: new LogController({ disableRequestLogging: true }),
  trustProxy: trust,
  bodyLimit: serverConfig.http.bodyLimitBytes,
  connectionTimeout: 30000,
  requestTimeout: 15000,
  keepAliveTimeout: 5000,
  routerOptions: { maxParamLength: 128 },
  return503OnClosing: true,
});
app.server.headersTimeout = 10000;

const database = createDatabase(serverConfig.databaseUrl, serverConfig.databasePoolSize);
database.on("error", throttledErrorLogger(app.log, "postgres pool error"));
await waitFor("postgres", () => database.query("SELECT 1"), app.log);
await migrateDatabase(database);

const redis = await createRedisClients(serverConfig.redisUrl, throttledErrorLogger(app.log, "redis connection error"));
const guard = new AbuseGuard(
  redis.rateLimit,
  { ...serverConfig.abuse, ...serverConfig.realtime },
  app.log.child({ component: "abuse" }),
);

const music = new MusicService(new MusicRepository(database));
const bus = new RoomBus(redis.commands, redis.subscriber, app.log.child({ component: "bus" }));
const directory = new RoomDirectory(redis.commands, bus, music, serverConfig.rooms, app.log.child({ component: "rooms" }));
const gateway = new RealtimeGateway({
  server: app.server,
  directory,
  guard,
  trust,
  allowedOrigins: serverConfig.allowedOrigins,
  limits: serverConfig.realtime,
  log: app.log.child({ component: "realtime" }),
});

app.addHook("onRequest", async (request, reply) => {
  if (await guard.isBanned(clientKey(request.ip))) {
    return reply.code(403).send({ error: "Too many requests from your address. Try again later." });
  }
});

await app.register(rateLimit, {
  global: true,
  max: serverConfig.http.requestsPerMinute,
  timeWindow: 60000,
  redis: redis.rateLimit,
  nameSpace: "np:rl:http:",
  skipOnError: true,
  ban: 30,
  onBanReach: (request) => void guard.strike(clientKey(request.ip), "http flood"),
  errorResponseBuilder: (_request, context) => ({
    statusCode: context.statusCode,
    error: `Too many requests. Try again in ${context.after}.`,
  }),
});

app.get(apiRoutePatterns.health, async () => ({ ok: true, instance: bus.instanceId, ...gateway.stats }));
app.get(apiRoutePatterns.rooms, async () => ({ rooms: directory.summaries }));
registerPlayerRoutes(app, new PlayerRepository(database), serverConfig.http.playerSavesPerMinute);
registerMusicRoutes(app, music, { requestsPerMinute: serverConfig.http.musicRequestsPerMinute });

await directory.start();
gateway.start();

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  const forceExit = setTimeout(() => process.exit(1), 15000);
  forceExit.unref();
  try {
    await gateway.close();
    await directory.stop();
    await app.close();
    await closeRedisClients(redis);
    await database.end();
  } catch (error) {
    app.log.error({ err: error }, "shutdown failed");
  }
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: serverConfig.host, port: serverConfig.port });
app.log.info(
  { instance: bus.instanceId, capacity: serverConfig.rooms.capacity, rooms: directory.summaries.map((room) => room.id) },
  "nightpaws realtime server ready",
);
