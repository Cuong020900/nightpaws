import type { DanceMoveDescriptor, DanceMoveId } from "./character.ts";

export const danceMoves: DanceMoveDescriptor[] = [
  { id: "bounce", displayName: "Bounce & Pump" },
  { id: "twostep", displayName: "Two-Step" },
  { id: "shuffle", displayName: "Shuffle" },
  { id: "robot", displayName: "Robot Pop" },
  { id: "point", displayName: "Disco Point" },
  { id: "handsup", displayName: "Hands Up" },
  { id: "roll", displayName: "Body Roll & Hit" },
  { id: "hype", displayName: "Hype Jump" },
  { id: "wristroll", displayName: "Wrist Roll Bounce" },
  { id: "woah", displayName: "The Woah" },
  { id: "runningman", displayName: "Running Man" },
  { id: "dougie", displayName: "Dougie" },
  { id: "floss", displayName: "Floss" },
  { id: "shoot", displayName: "Shoot" },
  { id: "millyrock", displayName: "Milly Rock" },
  { id: "gangnam", displayName: "Gangnam Gallop" },
];

export const allDanceMoveIds: DanceMoveId[] = danceMoves.map((move) => move.id);

export function danceMoveName(id: DanceMoveId): string {
  return danceMoves.find((move) => move.id === id)?.displayName ?? id;
}
