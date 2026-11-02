import type { CharacterTypeDescriptor } from "../character.ts";
import { allDanceMoveIds } from "../dances.ts";

export const pandaCharacter: CharacterTypeDescriptor = {
  id: "panda",
  displayName: "Panda",
  tagline: "Big kung-fu belly, goofy grin",
  height: 1.95,
  walkSpeed: 3.2,
  selectable: true,
  swatches: ["#dcd6cb", "#1d1a22", "#34d84e"],
  model: { kind: "hero-panda" },
  dances: allDanceMoveIds,
};
