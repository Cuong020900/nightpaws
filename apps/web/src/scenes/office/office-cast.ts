import type { CastMember } from "../common/scene-cast.ts";
import type { OfficeWorker } from "./office-life.ts";

export const officeCastMembers: CastMember[] = [
  { name: "DJ Kip", characterTypeId: "rabbit-cyan", outfitId: "electric-cyan", position: [0, 0, -10.75], facing: 0, routine: "dj", label: "#ffb84a" },
  { name: "Marlo", characterTypeId: "rabbit-pigtails", outfitId: "neon-magenta", position: [10.6, 0.78, 6.5], facing: -Math.PI / 2, routine: "auto", label: "#ff4fa3" },
  { name: "Hazel", characterTypeId: "rabbit-blond", outfitId: "sunset-gold", position: [-11.28, 0.76, -3.5], facing: Math.PI / 2, routine: "auto", mirrored: true },
  { name: "Pip", characterTypeId: "bunny", outfitId: "midnight-violet", position: [6.4, 0, 11.55], facing: Math.PI, groove: "handsup", label: "#3ad4ff" },
];

export const officeWorkers: OfficeWorker[] = [
  { name: "Tess", characterTypeId: "rabbit-grey", outfitId: "jade-master", seat: 8, routine: "desk" },
  { name: "Arlo", characterTypeId: "rabbit", outfitId: "crimson-dojo", seat: 10, routine: "desk" },
  { name: "Fern", characterTypeId: "bunny", outfitId: "neon-magenta", seat: 17, routine: "desk" },
  { name: "Gil", characterTypeId: "shark", outfitId: "midnight-violet", seat: 22, routine: "desk" },
  { name: "Moss", characterTypeId: "panda-patron", outfitId: "kung-fu-classic", seat: 11, routine: "cooler" },
  { name: "Remy", characterTypeId: "rabbit-cyan", outfitId: "sunset-gold", seat: 3, routine: "cooler" },
  { name: "Lola", characterTypeId: "rabbit-pigtails", outfitId: "electric-cyan", seat: 1, routine: "chat", cluster: 0 },
  { name: "Ozzie", characterTypeId: "rabbit-grey", outfitId: "neon-magenta", seat: 5, routine: "chat", cluster: 0 },
  { name: "Bruno", characterTypeId: "shark", outfitId: "sunset-gold", seat: 21, routine: "chat", cluster: 1 },
  { name: "Skye", characterTypeId: "rabbit-blond", outfitId: "jade-master", seat: 20, routine: "chat", cluster: 1 },
  { name: "Hank", characterTypeId: "panda-patron", outfitId: "crimson-dojo", seat: 23, routine: "chat", cluster: 1 },
  { name: "Zed", characterTypeId: "rabbit", outfitId: "electric-cyan", seat: 13, routine: "dance" },
];
