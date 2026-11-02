import * as THREE from "three";
import type { MusicPulse } from "../scenes/scene-module.ts";

const beatsPerMinute = 118;

export class BeatClock implements MusicPulse {
  isPlaying = false;
  energy = 0;
  beats = 0;

  update(deltaSeconds: number, musicPlaying: boolean): void {
    this.isPlaying = musicPlaying;
    this.beats += (deltaSeconds * beatsPerMinute) / 60;
    const target = musicPlaying ? 1 : 0;
    this.energy = THREE.MathUtils.damp(this.energy, target, musicPlaying ? 2.5 : 1.2, deltaSeconds);
  }
}
