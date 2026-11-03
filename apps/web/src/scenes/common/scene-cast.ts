import type { DanceMoveId, FloorRect } from "@nightpaws/shared";
import * as THREE from "three";
import { CharacterActor, type Routine } from "../../actors/character-actor.ts";
import { freeCrowd, type CrowdCue } from "../../actors/crowd-cue.ts";
import type { SceneFrame } from "../scene-module.ts";
import type { Triple } from "./club-kit.ts";

export interface CastMember {
  name: string;
  characterTypeId: string;
  outfitId: string;
  position: Triple;
  facing: number;
  routine?: Routine;
  groove?: DanceMoveId;
  mirrored?: boolean;
  label?: string;
}

interface Performer {
  member: CastMember;
  actor: CharacterActor;
  period: number;
  offset: number;
}

export class SceneCast {
  readonly obstacles: FloorRect[];
  private readonly performers: Performer[];
  private cue: CrowdCue = freeCrowd;

  constructor(parent: THREE.Object3D, castMembers: readonly CastMember[]) {
    this.performers = castMembers.map((member, index) => {
      const actor = new CharacterActor({
        name: member.name,
        appearance: { characterTypeId: member.characterTypeId, outfitId: member.outfitId },
        labelAccent: member.label ?? "#ffffff",
        showLabel: member.label !== undefined,
        mirrored: member.mirrored ?? false,
        danceIntensity: member.routine ? 1 : 0.8,
      });
      actor.position.set(...member.position);
      actor.facing = member.facing;
      actor.perform(member.routine ?? null);
      parent.add(actor.object);
      return { member, actor, period: 11 + (index % 5) * 1.9, offset: index * 3.3 };
    });
    this.obstacles = castMembers
      .filter((member) => member.position[1] === 0)
      .map(({ position: [x, , z] }) => ({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35 }));
  }

  update(frame: SceneFrame): void {
    const timing = { elapsedSeconds: frame.elapsedSeconds, beats: frame.music.beats };
    for (const performer of this.performers) {
      const { member, actor } = performer;
      if (member.groove && this.cue.kind === "free") {
        const duty = frame.music.isPlaying ? 0.7 : 0.3;
        const grooving = THREE.MathUtils.euclideanModulo((frame.elapsedSeconds + performer.offset) / performer.period, 1) < duty;
        if (grooving && actor.currentDance !== member.groove) actor.dance(member.groove);
        if (!grooving && actor.currentDance) actor.stopDancing();
      }
      actor.update(frame.deltaSeconds, timing, frame.view);
    }
  }

  setCue(cue: CrowdCue): void {
    this.cue = cue;
    for (const { member, actor } of this.performers) if (member.routine !== "dj") actor.setCue(cue);
  }

  dispose(): void {
    for (const performer of this.performers) performer.actor.dispose();
  }
}
