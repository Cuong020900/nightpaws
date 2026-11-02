import type { DanceMoveId } from "@nightpaws/shared";

export type CrowdCue = { kind: "free" } | { kind: "freeze" } | { kind: "sync"; move: DanceMoveId; startBeat: number };

export const freeCrowd: CrowdCue = { kind: "free" };
