import type { AnimationClipId, CharacterAppearance, RoomMusicState } from "@nightpaws/shared";
import * as THREE from "three";
import { BotCrowd } from "../actors/bot-crowd.ts";
import { CharacterActor } from "../actors/character-actor.ts";
import { BeatClock } from "../music/beat-clock.ts";
import { createSceneModule } from "../scenes/scene-registry.ts";
import type { SceneModule } from "../scenes/scene-module.ts";
import { MovementInput } from "./movement-input.ts";
import { OrbitCamera } from "./orbit-camera.ts";
import { WalkableSpace } from "./walkable-space.ts";
import { WorldRenderer } from "./world-renderer.ts";

export type GameMode = "intro" | "playing";

export interface GameOptions {
  canvas: HTMLCanvasElement;
  sceneId: string;
  playerName: string;
  playerAppearance: CharacterAppearance;
}

const maxFrameSeconds = 0.05;

export class Game {
  readonly input = new MovementInput();
  readonly scene: SceneModule;
  private readonly world: WorldRenderer;
  private readonly orbit: OrbitCamera;
  private readonly space: WalkableSpace;
  private readonly bots: BotCrowd;
  private readonly player: CharacterActor;
  private readonly beatClock = new BeatClock();
  private readonly timer = new THREE.Timer();
  private readonly intent = new THREE.Vector2();
  private readonly velocity = new THREE.Vector3();
  private mode: GameMode = "intro";
  private musicPlaying = false;
  private elapsedSeconds = 0;

  constructor(options: GameOptions) {
    this.world = new WorldRenderer(options.canvas);
    this.scene = createSceneModule(options.sceneId);
    this.world.scene.add(this.scene.root);

    this.space = new WalkableSpace(this.scene.descriptor.walkableArea, this.scene.obstacles);
    this.orbit = new OrbitCamera(this.world.camera, options.canvas);
    this.orbit.enabled = false;

    this.player = new CharacterActor({
      name: options.playerName,
      appearance: options.playerAppearance,
      labelAccent: "#ffffff",
      highlighted: true,
    });
    this.player.position.copy(this.scene.showcaseSpot);
    this.player.setLabelVisible(false);
    this.world.scene.add(this.player.object);

    this.bots = new BotCrowd(this.scene, this.space, this.world.scene);
    this.bots.populate(this.scene.descriptor.bots.count, this.scene.descriptor.bots.namePool);

    this.input.onKeyPress((code) => {
      const danceIndex = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(code);
      const dance = this.availableDances[danceIndex];
      if (dance) this.playEmote(dance);
    });
  }

  get currentMode(): GameMode {
    return this.mode;
  }

  get availableDances(): AnimationClipId[] {
    return this.player.descriptor.animations.dances;
  }

  get activeDance(): AnimationClipId | null {
    return this.player.currentDance;
  }

  get playerAppearance(): CharacterAppearance {
    return this.player.appearance;
  }

  start(): void {
    this.timer.connect(document);
    this.world.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }

  setPlayerAppearance(appearance: CharacterAppearance): void {
    this.player.setAppearance(appearance);
  }

  setPlayerName(name: string): void {
    this.player.setName(name);
  }

  enterWorld(): void {
    this.mode = "playing";
    const { spawn } = this.scene.descriptor;
    this.player.position.set(spawn.x, 0, spawn.z);
    this.player.facing = spawn.facing;
    this.orbit.yaw = spawn.facing + Math.PI;
    this.orbit.pitch = 0.42;
    this.orbit.distance = 8.5;
    this.orbit.enabled = true;
    this.player.setLabelVisible(true);
  }

  returnToIntro(): void {
    this.mode = "intro";
    this.orbit.enabled = false;
    this.player.stopDancing();
    this.player.setLabelVisible(false);
    this.player.position.copy(this.scene.showcaseSpot);
  }

  playEmote(clip: AnimationClipId): void {
    if (this.mode !== "playing") return;
    if (this.player.currentDance === clip) this.player.stopDancing();
    else this.player.dance(clip);
  }

  setMusicPlaying(isPlaying: boolean): void {
    this.musicPlaying = isPlaying;
  }

  showMusicState(state: RoomMusicState | null): void {
    this.scene.showMusicState(state);
  }

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const deltaSeconds = Math.min(this.timer.getDelta(), maxFrameSeconds);
    this.elapsedSeconds += deltaSeconds;
    this.beatClock.update(deltaSeconds, this.musicPlaying);
    const timing = { elapsedSeconds: this.elapsedSeconds, beats: this.beatClock.beats };

    if (this.mode === "playing") this.updatePlayerMovement(deltaSeconds);
    else this.updateIntroCamera();

    this.player.update(deltaSeconds, timing);
    this.bots.update(deltaSeconds, timing, this.beatClock, [this.player]);
    this.scene.update({ deltaSeconds, elapsedSeconds: this.elapsedSeconds, music: this.beatClock });
    this.orbit.update(deltaSeconds);
    this.world.render();
  }

  private updatePlayerMovement(deltaSeconds: number): void {
    this.input.readIntent(this.intent);
    this.velocity
      .copy(this.orbit.forwardOnGround)
      .multiplyScalar(this.intent.y)
      .addScaledVector(this.orbit.rightOnGround, this.intent.x)
      .multiplyScalar(this.player.descriptor.walkSpeed);
    this.player.moveWithVelocity(deltaSeconds, this.velocity, this.space);
    this.orbit.follow(this.player.position, 1.1);
  }

  private updateIntroCamera(): void {
    const portrait = window.innerWidth < window.innerHeight;
    this.orbit.yaw = Math.sin(this.elapsedSeconds * 0.25) * 0.35;
    this.orbit.pitch = 0.16;
    this.orbit.distance = portrait ? 6.4 : 4.4;
    this.player.facing = this.orbit.yaw;

    const sideOffset = portrait ? 0 : 1.15;
    const focus = this.scene.showcaseSpot
      .clone()
      .addScaledVector(this.orbit.rightOnGround, sideOffset)
      .setY(portrait ? -0.7 : 0.95);
    this.orbit.follow(focus, 0);
  }
}
