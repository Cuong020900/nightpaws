import type { DanceMoveId, FloorRect } from "@nightpaws/shared";
import * as THREE from "three";
import { CharacterActor, type Routine } from "../../actors/character-actor.ts";
import { freeCrowd, type CrowdCue } from "../../actors/crowd-cue.ts";
import type { SceneFrame } from "../scene-module.ts";
import type { Triple } from "./club-kit.ts";

interface CastMember {
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

const castMembers: CastMember[] = [
  { name: "DJ Finn", characterTypeId: "shark", outfitId: "midnight-violet", position: [0, 1.1, -8.95], facing: 0, routine: "dj", label: "#ffd23f" },
  { name: "Mira", characterTypeId: "rabbit-pigtails", outfitId: "neon-magenta", position: [-5.8, 1.7, -11.6], facing: 0.1, routine: "auto", mirrored: true },
  { name: "Skye", characterTypeId: "rabbit-cyan", outfitId: "electric-cyan", position: [5.8, 1.7, -11.6], facing: -0.1, routine: "auto" },
  { name: "Lux", characterTypeId: "rabbit-blond", outfitId: "sunset-gold", position: [-8.2, 1.2, -6.2], facing: 0.7, routine: "auto", mirrored: true },
  { name: "Clover", characterTypeId: "bunny", outfitId: "neon-magenta", position: [8.2, 1.2, -6.2], facing: -0.7, routine: "auto" },
  { name: "Juno", characterTypeId: "rabbit-grey", outfitId: "midnight-violet", position: [8.2, 0, 3.1], facing: -1.0, groove: "twostep", label: "#ff2e88" },
  { name: "Patron", characterTypeId: "rabbit-pigtails", outfitId: "sunset-gold", position: [13.2, 0.6, -6.0], facing: -1.9, groove: "millyrock" },
  { name: "Patron", characterTypeId: "panda-patron", outfitId: "jade-master", position: [12.4, 0.6, -1.2], facing: -1.6, groove: "handsup" },
  { name: "Patron", characterTypeId: "rabbit", outfitId: "electric-cyan", position: [-11.3, 0, -6.3], facing: 1.4, groove: "wristroll" },
  { name: "Patron", characterTypeId: "panda-patron", outfitId: "crimson-dojo", position: [-11.3, 0, -2.1], facing: 1.7, groove: "dougie" },
];

interface Performer {
  member: CastMember;
  actor: CharacterActor;
  period: number;
  offset: number;
}

export class ClubCast {
  readonly obstacles: FloorRect[];
  private readonly performers: Performer[];
  private cue: CrowdCue = freeCrowd;

  constructor(parent: THREE.Object3D) {
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
