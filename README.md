# nightpaws

A 3D social hangout that runs in the browser. You pick a name, a chunky,
stylized animal character, and a venue (a neon club or an after-hours office
party), walk in, request music from YouTube, and dance under moving lights. The
hero panda and both venues are built from procedural Three.js geometry and
canvas-generated textures. The supporting cast
are CC0 Quaternius models in `apps/web/public/models` (see `CREDITS.md` there).
It's designed to grow into many scenes and many character types.

## Run it

### Whole stack with Docker (one command)

Requirements: Docker with Compose v2.

```sh
cp .env.example .env
docker compose up --build
```

Open http://localhost:8080. Compose starts four services:

| Service | What it is | Reachable at |
| --- | --- | --- |
| `web` | nginx serving the built client, proxying `/api` and `/ws` | `http://localhost:${NIGHTPAWS_WEB_PORT:-8080}` |
| `server` | Fastify REST API plus the WebSocket room server | internal only, via `web` |
| `postgres` | Postgres 16, durable data, named volume `postgres-data` | `127.0.0.1:${POSTGRES_PORT:-5432}` |
| `redis` | Redis 7, ephemeral room state, no persistence | `127.0.0.1:${REDIS_PORT:-6379}` |

Every setting lives in `.env` (see `.env.example`): ports, the database
credentials, the room capacity, the queue length, and every rate limit. `.env`
is git-ignored. Put real secrets there, never in `docker-compose.yml`. A
password with URL-special characters must be percent-encoded, because the
server receives it inside `NIGHTPAWS_DATABASE_URL`.

Useful variations:

```sh
NIGHTPAWS_ROOM_CAPACITY=2 docker compose up --build -d
docker compose up --build -d --scale server=2
docker compose logs -f server
docker compose down
docker compose down -v
```

The first line tries the queue with a tiny room. The second runs two server
instances behind nginx; they share rooms through Redis. `down -v` also deletes
the Postgres volume.

### Local development

Requirements: Node 22.12+, pnpm 11, and Docker for the two databases.

```sh
pnpm install
pnpm db:up
pnpm dev
```

`pnpm db:up` starts only Postgres and Redis from the same compose file.
`pnpm dev` then starts both apps:

- backend: http://127.0.0.1:8787 (REST under `/api`, WebSocket at `/ws`)
- web: http://localhost:5173 (Vite proxies `/api` and `/ws` to the backend)

To run them separately, use `pnpm dev:server` and `pnpm dev:web`. Other scripts:
`pnpm typecheck` checks every package, `pnpm build` builds the web client,
`pnpm stack:up` and `pnpm stack:down` wrap the full compose stack. The web dev
server reads `NIGHTPAWS_API_URL`. The server reads the `NIGHTPAWS_*` variables
in [Configuration](#configuration). Its defaults match `pnpm db:up`.

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
- Leave the club with the Leave button. That frees your spot at once, so the
  next person in line gets in. Closing the tab keeps your spot for the resume
  grace period (20 seconds by default), so a reload puts you straight back in.

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
- `apps/server`: Fastify REST API and WebSocket room server, on Postgres and
  Redis.
  - `players/` and `music/`: profiles, saved characters (one row per type and
    outfit combination), the music-request log, and each room's now-playing
    track and queue, all in Postgres.
  - `realtime/`: the WebSocket gateway, one room hub per map, room membership
    and the waiting line (Redis Lua scripts), and the Redis pub/sub bus that
    links server instances.
  - `security/`: client address resolution, token buckets, and the abuse guard
    (bans, strikes, per-IP connection caps).
- `apps/web`: TypeScript, Vite, and vanilla Three.js.
  - `characters/` builds a character from its descriptor (the hand-built hero
    panda, or a cloned GLB with shared cached materials). It layers the
    code-authored dances on top of the model's own Idle and Walk clips, with
    two-bone leg IK.
  - `actors/` holds the player, the bots, and the remote players (snapshot
    interpolation of the other people in the room).
  - `realtime/` holds the room connection: join, queue, resume, and reconnect.
  - `scenes/` holds the scene registry and one module per map.
  - `music/` drives the YouTube IFrame player.
  - `ui/` holds the intro screen, the queue screen, the HUD, the joystick, and
    the request dialog.

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
  resident cast members. A module can list moving residents (the office's
  coworkers) so the bot crowd steps aside for them. Switching venues disposes the old module and its GPU
  resources, then builds the new one with a fresh bot crowd and music room.

### Music

A request is a YouTube URL or an 11-character video id. The server validates
it, looks up the title through oEmbed when it can, and queues it per room in
Postgres. The server promotes the next queued track when nothing is playing.
Every change to a room's music (a new request, a finished track, a promoted
track) is pushed to everyone in the room over the WebSocket. Clients outside a
room poll `GET /api/rooms/:roomId/music`. Each client starts the current track
at the elapsed offset, so everyone hears roughly the same moment. When the
track ends, or the video can't be embedded, the client reports
`POST .../music/finish`. That report is idempotent per request id. The DJ
screen, dance floor, and moving lights react while the player is actually
playing.

## Multiplayer

### Rooms and the waiting line

- There is exactly one room per map. The room id is the map's scene id, and
  the server creates one room for every entry in `sceneDescriptors`, so a new
  map gets its own room automatically. There are no extra rooms per map.
- A room holds `NIGHTPAWS_ROOM_CAPACITY` players (default 50).
- When the room is full, a new player joins a FIFO line and sees their
  position. When anyone leaves, the server admits the head of the line by
  itself and the waiting client walks straight into the club. If the room has
  free spots but people are already waiting, newcomers still queue behind
  them.
- The line is capped at `NIGHTPAWS_ROOM_MAX_QUEUE` (default 500). Past that,
  the server refuses the join, and the client retries later.
- Redis is the authority on who is inside and who is waiting. Admitting,
  queueing, promoting, and leaving are single Lua scripts, so two players can
  never take the last spot together, even across several server instances.
- Every spot and queue place is a lease that the owning server renews. If a
  server crashes, its players' spots expire within `NIGHTPAWS_ROOM_LEASE_MS`,
  and the line moves on without manual cleanup.
- When a connection drops without saying goodbye, the server holds that spot
  for `NIGHTPAWS_ROOM_RESUME_GRACE_MS`. The client reconnects with a resume
  token and gets the same spot back without queueing. The Leave button gives
  the spot up at once.

### Real-time sync

The client connects to `/ws` and says hello with the room, its name, and its
character and outfit. The server answers with `queued` (with the position) or
`welcome` (with everyone already in the room and the current music). After
that:

- The client sends its pose (position, facing, current dance) at most 10
  times a second, and only when something changed. Jumps and look changes are
  separate messages.
- Each room ticks every `NIGHTPAWS_ROOM_TICK_MS` (default 100 ms). A tick
  batches the poses that changed since the last tick into one message for the
  whole room, so traffic doesn't grow with frame rate. Join, leave, look
  change, music, and occupancy messages go out as they happen. Nothing crosses
  from one room to another.
- The server is authoritative for membership and keeps poses honest: it clamps
  them to the map's walkable area, limits speed to the character's walk speed
  with some slack, and sends a correction when a client moves too far.
- Remote players are full characters with the same rig, dances, and jumps as
  the local player. The client renders them slightly in the past and
  interpolates between ticks, so they move smoothly.
- Bots still fill a near-empty room. A room keeps `bots.count` from the scene
  descriptor as a crowd target, and each real player replaces one bot. Bots
  run on each client and are not shared; real players are.
- When a socket stalls (a slow consumer), the server drops its tick messages
  and sends it a full snapshot once it catches up. A socket that falls far
  behind is cut off.
- With more than one server instance, each instance publishes its rooms'
  events on a Redis channel per room, and the other instances forward them to
  their own players. A periodic roster message repairs anything missed.

### Abuse and flood protection

The app itself enforces these limits. All of them are configurable.

- **Connections per IP**: at most `NIGHTPAWS_WS_MAX_CONNECTIONS_PER_IP` open
  sockets per address (default 8), and `NIGHTPAWS_WS_MAX_CONNECTIONS` per
  instance. The server refuses extra upgrades with 429 or 503 before it
  allocates a WebSocket.
- **Connection rate**: at most `NIGHTPAWS_WS_CONNECTS_PER_MINUTE_PER_IP` new
  connections per minute per address, counted in Redis so it holds across
  instances.
- **Message rate**: each connection has token buckets. One covers all
  messages (`NIGHTPAWS_WS_MESSAGES_PER_SECOND`, burst
  `NIGHTPAWS_WS_MESSAGE_BURST`). Poses, jumps, look changes, and heartbeats
  each have their own tighter bucket. The server drops messages over the limit
  and warns the client.
- **Flood and spam**: dropped and malformed messages add to a decaying
  violation score. Past `NIGHTPAWS_WS_VIOLATIONS_BEFORE_KICK`, the server
  disconnects the client (close code 4008) and records a strike against its
  address. Binary frames, bad JSON, unknown message types, unknown dances or
  characters, and out-of-range numbers all count as malformed.
- **Bans**: `NIGHTPAWS_ABUSE_STRIKES_BEFORE_BAN` strikes within
  `NIGHTPAWS_ABUSE_STRIKE_WINDOW_SECONDS` ban the address for
  `NIGHTPAWS_ABUSE_BAN_SECONDS`. A banned address gets 403 on both HTTP and
  WebSocket upgrades. Bans live in Redis with a short local cache.
- **Payload size**: WebSocket messages over `NIGHTPAWS_WS_MAX_PAYLOAD_BYTES`
  (default 1 KB) close the socket (1009) and count as a strike. HTTP bodies are
  capped by `NIGHTPAWS_HTTP_BODY_LIMIT_BYTES`.
- **Dead and idle connections**: the server pings every
  `NIGHTPAWS_WS_HEARTBEAT_MS` and terminates sockets that don't answer. It
  closes sockets that never say hello within
  `NIGHTPAWS_WS_HANDSHAKE_TIMEOUT_MS`, and sockets with no client message for
  `NIGHTPAWS_WS_IDLE_TIMEOUT_MS`. Clients send a heartbeat every 15 seconds.
- **HTTP rate limits**: a Redis-backed limit for every route
  (`NIGHTPAWS_HTTP_REQUESTS_PER_MINUTE`), and tighter ones for music requests
  and profile saves. Clients that keep hitting the limit collect a strike.
  The server also enforces header, request, and keep-alive timeouts against
  slow-loris clients.
- **Origin allowlist**: set `NIGHTPAWS_ALLOWED_ORIGINS` to refuse WebSocket
  upgrades from other sites' pages.
- **Edge limits**: the bundled nginx adds per-IP request-rate and
  connection-count limits (`NGINX_*` variables) in front of the app.

These limits stop a single client, or a handful, from overwhelming the server.
They are not DDoS protection. A real volumetric or network-layer attack has
to be absorbed before it reaches the app: put a CDN or WAF with DDoS
mitigation (Cloudflare, AWS Shield with CloudFront or ALB, Fastly, and so on)
in front of nginx. That is infrastructure, not app code. Behind such a proxy,
set `NIGHTPAWS_TRUST_PROXY` to the proxy's addresses so the per-IP limits see
real client addresses. Without that, every client looks like the proxy.

### Why Postgres and Redis

- **Postgres** holds the durable data: player profiles, saved characters, and
  the music-request history. That data is relational (players own
  characters, requests point at players), it must survive restarts, and it
  needs concurrent writers. A partial unique index guarantees one playing
  track per room, and a per-room advisory lock serializes promotions across
  instances. SQLite is a single-file, single-writer database. It can't be
  shared by several server containers.
- **Redis** holds the hot, short-lived state: room membership, the waiting
  line, resume tokens, rate-limit counters, strikes, and bans. All of it
  expires on its own (leases and TTLs). Lua scripts make admission atomic,
  and pub/sub links server instances. Redis runs without persistence in
  compose, because none of this state has to survive a Redis restart: clients
  reconnect and the servers rebuild it from their live sockets.

### Configuration

The server reads these environment variables. Compose passes them through
from `.env`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NIGHTPAWS_HOST`, `NIGHTPAWS_PORT` | `127.0.0.1`, `8787` | listen address |
| `NIGHTPAWS_DATABASE_URL` | `postgres://nightpaws:nightpaws@127.0.0.1:5432/nightpaws` | Postgres connection |
| `NIGHTPAWS_DATABASE_POOL_SIZE` | `10` | Postgres pool size |
| `NIGHTPAWS_REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection |
| `NIGHTPAWS_TRUST_PROXY` | `loopback` | proxies whose `X-Forwarded-For` is trusted: addresses, CIDRs, `loopback`, `uniquelocal`, a hop count, or `false` |
| `NIGHTPAWS_ALLOWED_ORIGINS` | empty (any) | comma-separated origins allowed to open WebSockets |
| `NIGHTPAWS_ROOM_CAPACITY` | `50` | players per room |
| `NIGHTPAWS_ROOM_MAX_QUEUE` | `500` | longest waiting line per room |
| `NIGHTPAWS_ROOM_TICK_MS` | `100` | room broadcast interval |
| `NIGHTPAWS_ROOM_RESUME_GRACE_MS` | `20000` | how long a dropped player's spot is held |
| `NIGHTPAWS_ROOM_LEASE_MS` | `30000` | spot and queue-place lease, renewed by the owning server |
| `NIGHTPAWS_WS_MAX_CONNECTIONS` | `2000` | open sockets per server instance |
| `NIGHTPAWS_WS_MAX_CONNECTIONS_PER_IP` | `8` | open sockets per address |
| `NIGHTPAWS_WS_CONNECTS_PER_MINUTE_PER_IP` | `30` | new sockets per address per minute |
| `NIGHTPAWS_WS_MAX_PAYLOAD_BYTES` | `1024` | largest WebSocket message |
| `NIGHTPAWS_WS_MESSAGES_PER_SECOND`, `NIGHTPAWS_WS_MESSAGE_BURST` | `25`, `50` | per-connection message budget |
| `NIGHTPAWS_WS_POSES_PER_SECOND` | `15` | per-connection pose budget |
| `NIGHTPAWS_WS_VIOLATIONS_BEFORE_KICK` | `60` | violation score that disconnects a client |
| `NIGHTPAWS_WS_HANDSHAKE_TIMEOUT_MS` | `5000` | time allowed to say hello |
| `NIGHTPAWS_WS_IDLE_TIMEOUT_MS` | `90000` | silence allowed before disconnect |
| `NIGHTPAWS_WS_HEARTBEAT_MS` | `20000` | ping interval |
| `NIGHTPAWS_WS_MAX_BUFFERED_BYTES` | `1048576` | outbound backlog before a slow socket is cut |
| `NIGHTPAWS_ABUSE_STRIKES_BEFORE_BAN` | `3` | strikes that trigger a ban |
| `NIGHTPAWS_ABUSE_STRIKE_WINDOW_SECONDS` | `600` | strike memory |
| `NIGHTPAWS_ABUSE_BAN_SECONDS` | `300` | ban length |
| `NIGHTPAWS_HTTP_REQUESTS_PER_MINUTE` | `300` | HTTP requests per address per minute |
| `NIGHTPAWS_HTTP_MUSIC_REQUESTS_PER_MINUTE` | `6` | music requests per address per minute |
| `NIGHTPAWS_HTTP_PLAYER_SAVES_PER_MINUTE` | `20` | profile saves per address per minute |
| `NIGHTPAWS_HTTP_BODY_LIMIT_BYTES` | `16384` | largest HTTP body |
| `NIGHTPAWS_LOG_LEVEL` | `info` | log level |

Compose-only variables: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_PORT`, `REDIS_PORT`, `REDIS_MAXMEMORY`, `NIGHTPAWS_WEB_BIND`,
`NIGHTPAWS_WEB_PORT`, and the nginx edge limits `NGINX_API_RATE`,
`NGINX_API_BURST`, `NGINX_WS_RATE`, `NGINX_WS_BURST`, and
`NGINX_WS_CONNECTIONS_PER_IP`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | liveness, instance id, and socket counts |
| GET | `/api/rooms` | every room with players inside, capacity, and line length |
| POST | `/api/players` | create profile `{ displayName, appearance }` |
| GET | `/api/players/:id` | profile and saved characters |
| PUT | `/api/players/:id` | rename and switch character; saves a new combination |
| GET | `/api/rooms/:roomId/music` | now playing and queue |
| POST | `/api/rooms/:roomId/music/requests` | queue `{ video, requestedBy, playerId? }` |
| POST | `/api/rooms/:roomId/music/finish` | mark `{ requestId }` finished and advance |
| GET (upgrade) | `/ws` | WebSocket room connection; messages are typed in `packages/shared/src/realtime.ts` |

## Status

There are two maps, and each one is a shared real-time room with its own
music: up to 50 players see each other walk, dance, jump, and change outfits
live, with a waiting line when it is full.

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
  from a standing desk, Marlo dances on the meeting table, and Hazel dances on a
  desk. A dozen coworkers keep office hours between dances: they sit at their
  desks and type (their monitors light up while they work), walk to the water
  cooler or coffee machine to fill a cup and sip it, and gather in small groups
  to chat, with speech bubbles over whoever is talking. Each one moves on from
  work to a drink to a chat to the dance floor and back on their own schedule.

Simulated bots wander, lounge, and dance, more often while music plays, and
step aside as real players arrive.

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

## Future work

- More than one room per map (instances or shards of a busy map).
- Accounts and authentication. Profiles are anonymous; the browser remembers
  its player id.
- More maps and a larger character roster.
- User audio uploads.

## Credits

- Character models: CC0 Quaternius models, listed with sources and licenses in
  [`apps/web/public/models/CREDITS.md`](apps/web/public/models/CREDITS.md). The
  multiplayer work adds no new art assets.
- Server stack: [Fastify](https://fastify.dev),
  [`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit),
  [`ws`](https://github.com/websockets/ws), [`pg`](https://node-postgres.com),
  [`ioredis`](https://github.com/redis/ioredis), and
  [`proxy-addr`](https://github.com/jshttp/proxy-addr), all MIT licensed.
- Runtime images: Postgres, Redis, nginx, and Node from Docker Official Images.
