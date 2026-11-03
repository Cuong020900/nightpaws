import type { CharacterAppearance, DanceMoveId, PlayerPose, RoomMusicState } from "@nightpaws/shared";
import * as THREE from "three";
import { BotCrowd } from "../actors/bot-crowd.ts";
import { CharacterActor } from "../actors/character-actor.ts";
import { freeCrowd, type CrowdCue } from "../actors/crowd-cue.ts";
import { RemoteCrowd } from "../actors/remote-crowd.ts";
import { BeatClock } from "../music/beat-clock.ts";
import { createSceneModule } from "../scenes/scene-registry.ts";
import type { SceneModule } from "../scenes/scene-module.ts";
import { danceCycleKeys, danceHotkeys } from "./dance-hotkeys.ts";
import { disposeTree } from "./dispose-tree.ts";
import { FocusLights } from "./focus-lights.ts";
import { MovementInput } from "./movement-input.ts";
import { OrbitCamera } from "./orbit-camera.ts";
import { rimColor } from "./shading.ts";
import { ViewSample } from "./view-sample.ts";
import { WalkableSpace } from "./walkable-space.ts";
import { WorldRenderer } from "./world-renderer.ts";

export type GameMode = "intro" | "playing";

export type CrowdMode = CrowdCue["kind"];

export interface GameOptions {
  canvas: HTMLCanvasElement;
  sceneId: string;
  playerName: string;
  playerAppearance: CharacterAppearance;
}

const maxFrameSeconds = 0.05;
const spawnJitter = 1.2;

export class Game {
  readonly input = new MovementInput();
  private sceneModule: SceneModule;
  readonly remote: RemoteCrowd;
  onPlayerJump: (() => void) | null = null;
  private readonly world: WorldRenderer;
  private readonly orbit: OrbitCamera;
  private space: WalkableSpace;
  private bots: BotCrowd;
  private readonly player: CharacterActor;
  private readonly beatClock = new BeatClock();
  private readonly timer = new THREE.Timer();
  private readonly view = new ViewSample();
  private readonly focusLights = new FocusLights();
  private readonly intent = new THREE.Vector2();
  private readonly velocity = new THREE.Vector3();
  private mode: GameMode = "intro";
  private musicPlaying = false;
  private elapsedSeconds = 0;
  private crowdCue: CrowdCue = freeCrowd;
  private pickedDance: DanceMoveId | null = null;
  private liveRoom = false;

  constructor(options: GameOptions) {
    this.world = new WorldRenderer(options.canvas);
    this.sceneModule = createSceneModule(options.sceneId);
    this.world.scene.add(this.sceneModule.root);
    this.world.scene.add(this.focusLights.object);
    this.focusLights.setActive(true);

    this.space = new WalkableSpace(this.scene.descriptor.walkableArea, this.scene.obstacles);
    this.orbit = new OrbitCamera(this.world.camera, options.canvas);
    this.orbit.enabled = false;
    this.orbit.constrain = (focus, camera) => this.scene.constrainCamera(focus, camera);

    this.player = new CharacterActor({
      name: options.playerName,
      appearance: options.playerAppearance,
      labelAccent: "#ffffff",
      highlighted: true,
      quality: "hero",
      alwaysFullDetail: true,
      onBeat: true,
    });
    this.player.position.copy(this.scene.showcaseSpot);
    this.player.setLabelVisible(false);
    this.world.scene.add(this.player.object);

    this.bots = this.populateCrowd();
    this.remote = new RemoteCrowd(this.world.scene);

    this.input.onKeyPress((code) => {
      if (code === "Space") {
        this.jump();
        return;
      }
      if (code === "KeyF") {
        this.toggleCrowdFreeze();
        return;
      }
      if (code === "KeyG") {
        this.toggleCrowdSync();
        return;
      }
      const step = danceCycleKeys[code];
      if (step) {
        this.input.releaseKeys();
        this.cycleEmote(step);
        return;
      }
      const dance = this.availableDances[danceHotkeys.findIndex((hotkey) => hotkey.code === code)];
      if (dance) {
        this.input.releaseKeys();
        this.playEmote(dance);
      }
    });
  }

  get scene(): SceneModule {
    return this.sceneModule;
  }

  get currentMode(): GameMode {
    return this.mode;
  }

  get availableDances(): DanceMoveId[] {
    return this.player.descriptor.dances;
  }

  get activeDance(): DanceMoveId | null {
    return this.player.currentDance;
  }

  get crowdMode(): CrowdMode {
    return this.crowdCue.kind;
  }

  get crowdMove(): DanceMoveId | null {
    return this.crowdCue.kind === "sync" ? this.crowdCue.move : null;
  }

  get playerAppearance(): CharacterAppearance {
    return this.player.appearance;
  }

  get playerPose(): PlayerPose | null {
    if (this.mode !== "playing") return null;
    const { x, z } = this.player.position;
    return { x, z, f: this.player.facing, d: this.player.currentDance };
  }

  setLiveRoom(live: boolean): void {
    this.liveRoom = live;
    if (!live) this.remote.clear();
  }

  correctPlayerPosition(x: number, z: number): void {
    this.player.position.set(x, 0, z);
    this.space.constrain(this.player.position, this.player.radius);
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

  loadScene(sceneId: string): void {
    if (sceneId === this.sceneModule.descriptor.id) return;
    const next = createSceneModule(sceneId);
    this.setCrowdCue(freeCrowd);
    this.bots.dispose();
    const previous = this.sceneModule.root;
    this.sceneModule.dispose();
    disposeTree(previous);
    this.sceneModule = next;
    this.world.scene.add(next.root);
    this.space = new WalkableSpace(next.descriptor.walkableArea, next.obstacles);
    this.bots = this.populateCrowd();
    this.player.stopDancing();
    if (this.mode === "playing") this.placeAtSpawn();
    else this.player.position.copy(next.showcaseSpot);
  }

  enterWorld(): void {
    this.mode = "playing";
    this.placeAtSpawn();
    this.orbit.pitch = 0.42;
    this.orbit.distance = 7.5;
    this.orbit.enabled = true;
    this.input.capturing = true;
    this.player.setLabelVisible(true);
    this.focusLights.setActive(false);
  }

  private placeAtSpawn(): void {
    const { spawn } = this.scene.descriptor;
    const angle = Math.random() * Math.PI * 2;
    const reach = Math.sqrt(Math.random()) * spawnJitter;
    this.player.position.set(spawn.x + Math.cos(angle) * reach, 0, spawn.z + Math.sin(angle) * reach);
    this.space.constrain(this.player.position, this.player.radius);
    this.player.facing = spawn.facing;
    this.orbit.yaw = spawn.facing + Math.PI;
  }

  private populateCrowd(): BotCrowd {
    const crowd = new BotCrowd(this.scene, this.space, this.world.scene);
    crowd.populate(this.scene.descriptor.bots.count, this.scene.descriptor.bots.namePool);
    return crowd;
  }

  returnToIntro(): void {
    this.mode = "intro";
    this.orbit.enabled = false;
    this.input.capturing = false;
    this.orbit.constrain = (focus, camera) => this.scene.constrainCamera(focus, camera);
    this.focusLights.setActive(true);
    this.player.stopDancing();
    this.setCrowdCue(freeCrowd);
    this.player.setLabelVisible(false);
    this.player.position.copy(this.scene.showcaseSpot);
  }

  playEmote(move: DanceMoveId): void {
    if (this.mode !== "playing") return;
    if (this.player.currentDance === move) this.player.stopDancing();
    else this.pickDance(move);
  }

  jump(): void {
    if (this.mode !== "playing") return;
    if (this.player.jump()) this.onPlayerJump?.();
  }

  cycleEmote(step: number): void {
    if (this.mode !== "playing") return;
    const dances = this.availableDances;
    if (!dances.length) return;
    const current = this.player.currentDance ? dances.indexOf(this.player.currentDance) : step > 0 ? -1 : 0;
    this.pickDance(dances[THREE.MathUtils.euclideanModulo(current + step, dances.length)]!);
  }

  toggleCrowdFreeze(): void {
    if (this.mode !== "playing") return;
    this.setCrowdCue(this.crowdCue.kind === "freeze" ? freeCrowd : { kind: "freeze" });
  }

  toggleCrowdSync(): void {
    if (this.mode !== "playing") return;
    if (this.crowdCue.kind === "sync") {
      this.setCrowdCue(freeCrowd);
      return;
    }
    const move = this.player.currentDance ?? this.pickedDance ?? this.availableDances[0];
    if (!move) return;
    this.player.dance(move);
    this.syncCrowd(move);
  }

  private pickDance(move: DanceMoveId): void {
    this.pickedDance = move;
    this.player.dance(move);
    if (this.crowdCue.kind === "sync" && this.crowdCue.move !== move) this.syncCrowd(move);
  }

  private syncCrowd(move: DanceMoveId): void {
    this.setCrowdCue({ kind: "sync", move, startBeat: Math.ceil(this.beatClock.beats + 0.25) });
  }

  private setCrowdCue(cue: CrowdCue): void {
    this.crowdCue = cue;
    this.bots.setCue(cue);
    this.scene.setCrowdCue(cue);
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

    this.orbit.update(deltaSeconds);
    this.view.capture(this.world.camera);
    this.player.update(deltaSeconds, timing, this.view);
    this.remote.update(deltaSeconds, timing, this.view);
    const { count } = this.scene.descriptor.bots;
    this.bots.resize(this.liveRoom ? Math.max(0, count - this.remote.count - 1) : count);
    this.bots.update(deltaSeconds, timing, this.beatClock, [this.player, ...this.remote.actors], this.view, this.player.position);
    this.scene.update({ deltaSeconds, elapsedSeconds: this.elapsedSeconds, music: this.beatClock, view: this.view });
    this.focusLights.update(deltaSeconds, this.player.position, this.player.facing, this.player.headHeight, rimColor.value);
    this.world.applyLook(this.scene.look);
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
