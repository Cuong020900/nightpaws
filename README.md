# nightpaps — working name: nightpaws

A 3D social hangout built in the browser, designed to grow into many scenes and
character types. The first scene is a neon bar/club: pick a name and a stylized
animal-ish character (Kung Fu Panda–style, low detail), walk in, request music
(YouTube), and dance under moving lights.

## Status

Scaffold only. Nothing is implemented yet — the real build is tracked separately.

## Planned shape

Monorepo (pnpm workspaces):

- `apps/web` — 3D client: TypeScript + Vite + Three.js (vanilla).
- `apps/server` — lightweight backend: Node + Fastify + SQLite (profiles, saved
  characters, music request log). Single-player world populated by simulated
  bots for now; designed to be upgradable to a real-time shared room later.
- `packages/shared` — data-driven definitions shared by client and server:
  character parts/palettes/animations, scene/map descriptors, so adding a new
  character type or map is a new data file, not an engine change.

## v1 scope

- Intro screen: choose display name + character + outfit, then enter.
- One map: a neon bar/club with moving lights.
- A few character types (procedural, low-poly, simple rig for idle / walk / dance).
- Music: embedded YouTube playback, requestable in-world.
- Dance emotes.
