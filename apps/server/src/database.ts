import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

const schema = `
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    active_character_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    character_type_id TEXT NOT NULL,
    outfit_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (player_id, character_type_id, outfit_id)
  );

  CREATE TABLE IF NOT EXISTS music_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT,
    requested_by TEXT NOT NULL,
    player_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('queued', 'playing', 'finished')),
    requested_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
  );

  CREATE INDEX IF NOT EXISTS music_requests_room_status ON music_requests (room_id, status, id);
`;

export function openDatabase(path: string): AppDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(schema);
  return database;
}
