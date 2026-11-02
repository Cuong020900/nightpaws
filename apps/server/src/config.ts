import { fileURLToPath } from "node:url";

const defaultDatabasePath = fileURLToPath(new URL("../data/nightpaws.sqlite", import.meta.url));

export const serverConfig = {
  host: process.env.NIGHTPAWS_HOST ?? "127.0.0.1",
  port: Number(process.env.NIGHTPAWS_PORT ?? 8787),
  databasePath: process.env.NIGHTPAWS_DB_PATH ?? defaultDatabasePath,
};
