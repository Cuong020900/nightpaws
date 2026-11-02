import {
  danceMoves,
  requireCharacterType,
  requireOutfit,
  type CharacterAppearance,
  type CharacterTypeDescriptor,
  type DanceMoveId,
} from "@nightpaws/shared";
import * as THREE from "three";
import { CharacterAnimator } from "../characters/character-animator.ts";
import { buildCharacterModel, type CharacterModel, type ShadingQuality } from "../characters/character-model.ts";
import type { PoseKey } from "../characters/dance-poses.ts";
import { createNameLabel } from "../engine/name-label.ts";
import type { ViewSample } from "../engine/view-sample.ts";
import type { WalkableSpace } from "../engine/walkable-space.ts";

export interface ActorTiming {
  elapsedSeconds: number;
  beats: number;
}

export type Routine = "dj" | "auto";

export interface CharacterActorOptions {
  name: string;
  appearance: CharacterAppearance;
  labelAccent: string;
  highlighted?: boolean;
  showLabel?: boolean;
  quality?: ShadingQuality;
  mirrored?: boolean;
  danceIntensity?: number;
  alwaysFullDetail?: boolean;
}

const turnSpeed = 10;
const strideLength = 0.55;
const fullDetailDistance = 10;
const halfRateDistance = 18;

let blobTexture: THREE.CanvasTexture | null = null;

function shadowTexture(): THREE.CanvasTexture {
  if (blobTexture) return blobTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(0,0,0,0.7)");
  gradient.addColorStop(0.6, "rgba(0,0,0,0.3)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  blobTexture = new THREE.CanvasTexture(canvas);
  return blobTexture;
}

const shadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
let shadowMaterial: THREE.MeshBasicMaterial | null = null;

function blobShadow(size: number): THREE.Mesh {
  shadowMaterial ??= new THREE.MeshBasicMaterial({
    map: shadowTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
  mesh.position.y = 0.012;
  mesh.scale.setScalar(size);
  return mesh;
}

function angleTowards(current: number, target: number, maxStep: number): number {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}

const boundsCenter = new THREE.Vector3();
const bounds = new THREE.Sphere();

export class CharacterActor {
  readonly object = new THREE.Group();
  readonly radius = 0.42;
  facing = 0;
  private descriptorValue!: CharacterTypeDescriptor;
  private model!: CharacterModel;
  private animator!: CharacterAnimator;
  private shadow: THREE.Mesh | null = null;
  private label: THREE.Sprite | null = null;
  private readonly velocity = new THREE.Vector3();
  private speed = 0;
  private stridePhase = 0;
  private danceMove: DanceMoveId | null = null;
  private routine: Routine | null = null;
  private name: string;
  private appearanceValue!: CharacterAppearance;
  private labelVisible = true;
  private pendingSeconds = 0;
  private readonly lodPhase = Math.floor(Math.random() * 6);

  constructor(private readonly options: CharacterActorOptions) {
    this.name = options.name;
    this.setAppearance(options.appearance);
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  get descriptor(): CharacterTypeDescriptor {
    return this.descriptorValue;
  }

  get appearance(): CharacterAppearance {
    return this.appearanceValue;
  }

  get displayName(): string {
    return this.name;
  }

  get isDancing(): boolean {
    return this.danceMove !== null || this.routine !== null;
  }

  get currentDance(): DanceMoveId | null {
    return this.danceMove;
  }

  get headHeight(): number {
    return this.descriptorValue.height;
  }

  setAppearance(appearance: CharacterAppearance): void {
    const descriptor = requireCharacterType(appearance.characterTypeId);
    const outfit = requireOutfit(appearance.outfitId);
    if (this.model) this.object.remove(this.model.root);
    this.descriptorValue = descriptor;
    this.appearanceValue = { characterTypeId: descriptor.id, outfitId: outfit.id };
    this.model = buildCharacterModel(descriptor, outfit, this.options.quality ?? "crowd");
    this.animator = new CharacterAnimator(this.model);
    this.object.add(this.model.root);
    if (this.shadow) this.object.remove(this.shadow);
    this.shadow = blobShadow(descriptor.height * (this.model.procedural ? 0.9 : 0.75));
    this.object.add(this.shadow);
    if (this.danceMove && !descriptor.dances.includes(this.danceMove)) this.danceMove = null;
    this.refreshLabel();
  }

  setName(name: string): void {
    this.name = name;
    this.refreshLabel();
  }

  setLabelVisible(visible: boolean): void {
    this.labelVisible = visible;
    if (this.label) this.label.visible = visible;
  }

  dance(move: DanceMoveId): void {
    this.danceMove = move;
  }

  perform(routine: Routine | null): void {
    this.routine = routine;
  }

  stopDancing(): void {
    this.danceMove = null;
  }

  moveWithVelocity(deltaSeconds: number, desiredVelocity: THREE.Vector3, space: WalkableSpace | null): void {
    this.velocity.copy(desiredVelocity);
    const speed = this.velocity.length();
    if (speed < 0.05) return;

    this.danceMove = null;
    this.position.addScaledVector(this.velocity, deltaSeconds);
    space?.constrain(this.position, this.radius);
    this.facing = angleTowards(this.facing, Math.atan2(this.velocity.x, this.velocity.z), turnSpeed * deltaSeconds);
    this.stridePhase += (speed * deltaSeconds * Math.PI) / (strideLength * (this.descriptorValue.height / 1.8));
  }

  faceTowards(target: THREE.Vector3, deltaSeconds: number): void {
    const desired = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    this.facing = angleTowards(this.facing, desired, turnSpeed * 0.5 * deltaSeconds);
  }

  update(deltaSeconds: number, timing: ActorTiming, view: ViewSample | null): void {
    const moving = this.velocity.lengthSq() > 0.0025;
    if (moving) this.speed = this.velocity.length();
    this.velocity.set(0, 0, 0);
    this.object.rotation.y = this.facing;
    this.pendingSeconds += deltaSeconds;

    let lite = false;
    if (view && !this.options.alwaysFullDetail) {
      const height = this.descriptorValue.height;
      boundsCenter.copy(this.position).y += height / 2;
      bounds.set(boundsCenter, height * 0.8);
      const inView = view.frustum.intersectsSphere(bounds);
      this.object.visible = inView;
      if (!inView) return;
      const distance = view.cameraPosition.distanceTo(boundsCenter);
      const interval = distance < fullDetailDistance ? 1 : distance < halfRateDistance ? 2 : 3;
      lite = distance >= fullDetailDistance;
      if ((view.frame + this.lodPhase) % interval !== 0) return;
    }

    this.object.updateWorldMatrix(true, false);
    this.animator.update({
      deltaSeconds: this.pendingSeconds,
      elapsedSeconds: timing.elapsedSeconds,
      beats: timing.beats,
      moving,
      speed: this.speed,
      stridePhase: this.stridePhase,
      dance: this.poseKey(timing.beats),
      mirrored: this.options.mirrored ?? false,
      intensity: this.options.danceIntensity ?? 1,
      lite,
    });
    this.pendingSeconds = 0;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.label?.material.map?.dispose();
    this.label?.material.dispose();
  }

  private poseKey(beats: number): PoseKey | null {
    if (this.routine === "dj") return "dj";
    if (this.routine === "auto") return danceMoves[Math.floor(beats / 16) % danceMoves.length]!.id;
    return this.danceMove;
  }

  private refreshLabel(): void {
    if (this.label) {
      this.object.remove(this.label);
      this.label.material.map?.dispose();
      this.label.material.dispose();
      this.label = null;
    }
    if (this.options.showLabel === false) return;
    this.label = createNameLabel(this.name, { accent: this.options.labelAccent, highlighted: this.options.highlighted });
    this.label.position.set(0, this.headHeight + 0.35, 0);
    this.label.visible = this.labelVisible;
    this.object.add(this.label);
  }
}
