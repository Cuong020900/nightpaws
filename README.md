# nightpaws

A 3D social hangout that runs in the browser. You pick a name, a chunky,
stylized animal character, and a venue (a neon club or an after-hours office
party), walk in, request music from YouTube, and dance under moving lights. The
hero panda and both venues are built from procedural Three.js geometry and
canvas-generated textures. The supporting cast
are CC0 Quaternius models in `apps/web/public/models` (see `CREDITS.md` there).
It's designed to grow into many scenes and many character types.

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
- Dance with the dance buttons, keys `1`–`0` and `Z`–`N`, or cycle moves with
  `Q`/`E`. Moving cancels the dance.
- Jump with `Space`.
- Hide or show the HUD with `H` or the Hide UI button.
- Switch venue from the intro screen. In game, the Look & venue button returns
  to it. `?venue=office` in the URL opens a venue directly, and the browser
  remembers the last one.
- Queue a YouTube link or video id with the ♪ Request button (or `M`).

## Layout

pnpm workspaces:

- `packages/shared`: data and types shared by client and server.
  - Character descriptors: height, walk speed, model source (the procedural
    hero panda or a GLB asset), and the dance moves it can do.
  - Dance moves: the sixteen club dance loops and their names.
  - Outfits: shared color schemes.
  - Scene descriptors: walkable area, spawn point, bot population.
  - Music-request and player-profile shapes, API routes, and the registries
    (`characterTypes`, `outfits`, `sceneDescriptors`).
- `apps/server`: Fastify REST API on SQLite (better-sqlite3).
  - Player profiles, saved characters (one row per type and outfit combination),
    the music-request log, and each room's now-playing track and queue.
- `apps/web`: TypeScript, Vite, and vanilla Three.js.
  - `characters/` builds a character from its descriptor (the hand-built hero
    panda, or a cloned GLB with shared cached materials). It layers the
    code-authored dances on top of the model's own Idle and Walk clips, with
    two-bone leg IK.
  - `actors/` holds the player and bot behaviour.
  - `scenes/` holds the scene registry and one module per map.
  - `music/` drives the YouTube IFrame player.
  - `ui/` holds the intro screen, HUD, joystick, and request dialog.

### Adding content

- **A character type**: add a `CharacterTypeDescriptor` under
  `packages/shared/src/characters/` and list it in `characterTypes`
  (`registry.ts`). A GLB character needs a biped rig with the Quaternius bone
  names (Body, Hips, Torso, Head, UpperArm.L, LowerArm.L, UpperLeg.L,
  LowerLeg.L, Foot.L, and so on), so every dance drives it. Put the file in
  `apps/web/public/models/` and add its source and license to `CREDITS.md`.
  `selectable: false` keeps a type out of the intro picker; bots still use it.
  New dance moves go in `apps/web/src/characters/dance-poses.ts` and
  `packages/shared/src/dances.ts`.
- **An outfit**: add an entry to `packages/shared/src/outfits.ts`.
- **A map**: add a `SceneDescriptor` to `sceneDescriptors` (its display name,
  tagline, enter label, and swatches feed the intro's venue picker). Then
  create a `SceneModule` under `apps/web/src/scenes/<map>/` and register its
  factory in `scene-registry.ts`. Scene-specific logic lives in the module, as
  the club's zones, lighting rig, and LED wall do in `scenes/neon-bar/` and the
  office's do in `scenes/office/`. Shared pieces live in `scenes/common/`: the
  neon kit, the beat-reactive VJ screen, and `SceneCast`, which takes a list of
  resident cast members. Switching venues disposes the old module and its GPU
  resources, then builds the new one with a fresh bot crowd and music room.

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

There are two maps, and each one has its own music room.

- The Neon Paw club. Its zones are the entrance, the dance floor, the stage and
  DJ booth, the bar and booths, and VIP. The resident cast works the club: DJ
  Finn on the decks, four go-go dancers on the podiums running the full routine
  (mirrored in pairs), Juno at the VIP rope, and regulars at the bar and in VIP.
- Pawsworks HQ, an open-plan office on the 12th floor after hours. It has desk
  pods with glowing monitors, a meeting nook, a pantry with a snack island and
  water cooler, reception and elevators, and floor-to-ceiling windows over a
  night skyline. The party is in the cleared all-hands area: a wooden dance
  floor under a disco ball, string lights, ceiling panels that chase the beat,
  clamp-on party spots, and a big TV wall running the VJ visuals. DJ Kip plays
  from a standing desk, Marlo dances on the meeting table, Hazel dances on a
  desk, and coworkers groove around the office.

Simulated bots wander, lounge, and dance, more often while music plays.

Players pick from eight characters: the hand-built hero panda, five rabbits, a
bunny, and a shark. There are seven outfits and eight dance moves.

Performance choices:

- The pixel ratio is capped at 1.5, and there are no shadow maps (blob
  shadows only).
- The club has ten real-time lights. The light beams are additive cones.
- The dance floor and bottle wall are instanced. The office batches its
  furniture into one instanced mesh per material and shape, and has nine
  real-time lights.
- Characters share cloned geometry and cached materials.
- Characters outside the camera view are skipped. Distant ones update at half
  or third rate with a lite pose that has no leg IK.

## Future work (out of scope for v1)

- Real-time shared multiplayer. The room id is already the scene id, and bots
  are a separate crowd component a live room could replace.
- Accounts and authentication. Profiles are anonymous; the browser remembers
  its player id.
- More maps and a larger character roster.
- User audio uploads.
