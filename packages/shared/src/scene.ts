export interface FloorRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SpawnPoint {
  x: number;
  z: number;
  facing: number;
}

export interface BotPopulation {
  count: number;
  namePool: string[];
}

export interface SceneDescriptor {
  id: string;
  displayName: string;
  tagline: string;
  walkableArea: FloorRect;
  spawn: SpawnPoint;
  bots: BotPopulation;
  hasMusic: boolean;
}
