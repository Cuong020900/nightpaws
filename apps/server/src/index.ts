import { apiRoutePatterns } from "@nightpaws/shared";
import Fastify from "fastify";
import { serverConfig } from "./config.ts";
import { openDatabase } from "./database.ts";
import { MusicRepository } from "./music/music-repository.ts";
import { registerMusicRoutes } from "./music/music-routes.ts";
import { PlayerRepository } from "./players/player-repository.ts";
import { registerPlayerRoutes } from "./players/player-routes.ts";

const database = openDatabase(serverConfig.databasePath);
const app = Fastify({ logger: { level: "info" }, disableRequestLogging: true });

app.get(apiRoutePatterns.health, async () => ({ ok: true }));
registerPlayerRoutes(app, new PlayerRepository(database));
registerMusicRoutes(app, new MusicRepository(database));

const shutdown = async () => {
  await app.close();
  database.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: serverConfig.host, port: serverConfig.port });
