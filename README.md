# nightpaws

A 3D social hangout that runs in the browser. You pick a name and a chunky,
stylized animal character, walk into a neon club, request music from YouTube,
and dance under moving lights. The world is built from procedural Three.js
geometry and canvas-generated textures, with no model, texture, or audio asset
files. It's designed to grow into many scenes and many character types.

## Run it

Requirements: Node 22.12+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts both apps:

- backend: http://127.0.0.1:8787 (Fastify + SQLite, file at `apps/server/data/nightpaws.sqlite`)
- web: http://localhost:5173 (Vite proxies `/api` to the backend)

To run them separately, use `pnpm dev:server` and `pnpm dev:web`. Other scripts:
`pnpm typecheck` checks every package and `pnpm build` builds the web client.
The server reads `NIGHTPAWS_HOST`, `NIGHTPAWS_PORT`, and `NIGHTPAWS_DB_PATH`.
The web dev server reads `NIGHTPAWS_API_URL`.

## Controls

- Drag to orbit the camera. Use the mouse wheel or pinch to zoom.
- Move with WASD, the arrow keys, or the on-screen joystick.
- Dance with the dance buttons or keys `1`–`3`. Moving cancels the dance.
- Queue a YouTube link or video id with the ♪ Request button (or `M`).

## Layout

pnpm workspaces:

- `packages/shared`: data and types shared by client and server.
  - Character descriptors: rig proportions, parts, palette slots, animation set.
  - Outfits: shared color schemes.
  - Scene descriptors: walkable area, spawn point, bot population.
  - Music-request and player-profile shapes, API routes, and the registries
    (`characterTypes`, `outfits`, `sceneDescriptors`).
- `apps/server`: Fastify REST API on SQLite (better-sqlite3).
  - Player profiles, saved characters (one row per type and outfit combination),
    the music-request log, and each room's now-playing track and queue.
- `apps/web`: TypeScript, Vite, and vanilla Three.js.
  - `characters/` builds a character from its descriptor and animates it with
    procedural clips.
  - `actors/` holds the player and bot behaviour.
  - `scenes/` holds the scene registry and one module per map.
  - `music/` drives the YouTube IFrame player.
  - `ui/` holds the intro screen, HUD, joystick, and request dialog.

### Adding content

- **A character type**: add a `CharacterTypeDescriptor` under
  `packages/shared/src/characters/` and list it in `characterTypes`
  (`registry.ts`). Parts are primitives (sphere, box, capsule, cylinder, cone,
  torus) attached to rig bones and colored through palette slots. The
  descriptor names its idle, walk, and dance clips. New clips go in
  `apps/web/src/characters/animation-clips.ts`.
- **An outfit**: add an entry to `packages/shared/src/outfits.ts`.
- **A map**: add a `SceneDescriptor` to `sceneDescriptors`. Then create a
  `SceneModule` under `apps/web/src/scenes/<map>/` and register its factory in
  `scene-registry.ts`. Scene-specific logic lives in the module, as the bar's
  lights, DJ booth, and dance floor do in `scenes/neon-bar/`.

### Music

A request is a YouTube URL or an 11-character video id. The server validates
it, looks up the title through oEmbed when it can, and queues it per room. The
server promotes the next queued track when nothing is playing. Clients poll
`GET /api/rooms/:roomId/music` every few seconds. Each client starts the
current track at the elapsed offset, so everyone hears roughly the same moment.
When the track ends, or the video can't be embedded, the client reports
`POST .../music/finish`. That report is idempotent per request id. The DJ
screen, dance floor, and moving lights react while the player is actually
playing.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | liveness |
| POST | `/api/players` | create profile `{ displayName, appearance }` |
| GET | `/api/players/:id` | profile and saved characters |
| PUT | `/api/players/:id` | rename and switch character; saves a new combination |
| GET | `/api/rooms/:roomId/music` | now playing and queue |
| POST | `/api/rooms/:roomId/music/requests` | queue `{ video, requestedBy, playerId? }` |
| POST | `/api/rooms/:roomId/music/finish` | mark `{ requestId }` finished and advance |

## Status

v1 has one map, The Neon Paw bar. There are four character types (panda,
tiger, bunny, fox) and six outfits. The bar is filled with simulated bots that
wander, lounge, and dance when music plays.

The character models and bar visuals are placeholders until the art direction
is approved. They sit behind the character and scene registries, so swapping
in the approved look is a data and module change.

## Future work (out of scope for v1)

- Real-time shared multiplayer. The room id is already the scene id, and bots
  are a separate crowd component a live room could replace.
- Accounts and authentication. Profiles are anonymous; the browser remembers
  its player id.
- More maps and a larger character roster.
- User audio uploads.
