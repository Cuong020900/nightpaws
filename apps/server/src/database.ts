import pg from "pg";

export type AppDatabase = pg.Pool;

const migrations: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE players (
        id uuid PRIMARY KEY,
        display_name text NOT NULL,
        active_character_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE characters (
        id uuid PRIMARY KEY,
        player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        character_type_id text NOT NULL,
        outfit_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (player_id, character_type_id, outfit_id)
      );

      CREATE TABLE music_requests (
        id bigserial PRIMARY KEY,
        room_id text NOT NULL,
        video_id text NOT NULL,
        title text,
        requested_by text NOT NULL,
        player_id uuid REFERENCES players(id) ON DELETE SET NULL,
        status text NOT NULL CHECK (status IN ('queued', 'playing', 'finished')),
        requested_at timestamptz NOT NULL DEFAULT now(),
        started_at timestamptz,
        finished_at timestamptz
      );

      CREATE INDEX music_requests_room_status ON music_requests (room_id, status, id);
      CREATE UNIQUE INDEX music_requests_one_playing ON music_requests (room_id) WHERE status = 'playing';
    `,
  },
];

export function createDatabase(connectionString: string, poolSize: number): AppDatabase {
  return new pg.Pool({
    connectionString,
    max: poolSize,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    application_name: "nightpaws-server",
  });
}

export async function migrateDatabase(database: AppDatabase): Promise<void> {
  const client = await database.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('nightpaws-migrations'))");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const applied = await client.query<{ version: number }>("SELECT version FROM schema_migrations");
    const done = new Set(applied.rows.map((row) => row.version));
    for (const migration of migrations) {
      if (done.has(migration.version)) continue;
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migration.version]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('nightpaws-migrations'))").catch(() => undefined);
    client.release();
  }
}

export async function withTransaction<T>(database: AppDatabase, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
