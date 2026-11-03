import type { CastMember } from "../common/scene-cast.ts";

export const officeCastMembers: CastMember[] = [
  { name: "DJ Kip", characterTypeId: "rabbit-cyan", outfitId: "electric-cyan", position: [0, 0, -10.75], facing: 0, routine: "dj", label: "#ffb84a" },
  { name: "Marlo", characterTypeId: "rabbit-pigtails", outfitId: "neon-magenta", position: [10.6, 0.78, 6.5], facing: -Math.PI / 2, routine: "auto", label: "#ff4fa3" },
  { name: "Hazel", characterTypeId: "rabbit-blond", outfitId: "sunset-gold", position: [-11.28, 0.76, -3.5], facing: Math.PI / 2, routine: "auto", mirrored: true },
  { name: "Pip", characterTypeId: "bunny", outfitId: "midnight-violet", position: [6.4, 0, 11.55], facing: Math.PI, groove: "handsup", label: "#3ad4ff" },
  { name: "Coworker", characterTypeId: "panda-patron", outfitId: "kung-fu-classic", position: [-13.45, 0, 1.45], facing: 1.2, groove: "dougie" },
  { name: "Coworker", characterTypeId: "rabbit", outfitId: "jade-master", position: [-11.6, 0, 4.85], facing: 2.9, groove: "twostep" },
  { name: "Coworker", characterTypeId: "rabbit-grey", outfitId: "crimson-dojo", position: [11.2, 0, -5.55], facing: -1.7, groove: "robot" },
  { name: "Coworker", characterTypeId: "shark", outfitId: "sunset-gold", position: [-6.2, 0, 8.85], facing: Math.PI, groove: "wristroll" },
];
