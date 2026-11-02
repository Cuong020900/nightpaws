import {
  requireCharacterType,
  requireOutfit,
  type AnimationClipId,
  type CharacterAppearance,
  type CharacterTypeDescriptor,
} from "@nightpaws/shared";
import * as THREE from "three";
import { CharacterAnimator } from "../characters/character-animator.ts";
import { buildCharacter, type BuiltCharacter } from "../characters/character-builder.ts";
import { createNameLabel } from "../engine/name-label.ts";
import type { WalkableSpace } from "../engine/walkable-space.ts";

export interface ActorTiming {
  elapsedSeconds: number;
  beats: number;
}

export interface CharacterActorOptions {
  name: string;
  appearance: CharacterAppearance;
  labelAccent: string;
  highlighted?: boolean;
  showLabel?: boolean;
}

const turnSpeed = 10;
const strideLength = 0.55;

function angleTowards(current: number, target: number, maxStep: number): number {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}

export class CharacterActor {
  readonly object = new THREE.Group();
  readonly radius = 0.42;
  facing = 0;
  private built!: BuiltCharacter;
  private animator!: CharacterAnimator;
  private label: THREE.Sprite | null = null;
  private readonly velocity = new THREE.Vector3();
  private stridePhase = 0;
  private danceClip: AnimationClipId | null = null;
  private name: string;
  private appearanceValue!: CharacterAppearance;
  private labelVisible = true;

  constructor(private readonly options: CharacterActorOptions) {
    this.name = options.name;
    this.setAppearance(options.appearance);
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  get descriptor(): CharacterTypeDescriptor {
    return this.built.descriptor;
  }

  get appearance(): CharacterAppearance {
    return this.appearanceValue;
  }

  get displayName(): string {
    return this.name;
  }

  get isDancing(): boolean {
    return this.danceClip !== null;
  }

  get currentDance(): AnimationClipId | null {
    return this.danceClip;
  }

  get headHeight(): number {
    return this.built.rig.headTopHeight * this.built.descriptor.scale;
  }

  setAppearance(appearance: CharacterAppearance): void {
    const descriptor = requireCharacterType(appearance.characterTypeId);
    const outfit = requireOutfit(appearance.outfitId);
    if (this.built) this.object.remove(this.built.root);
    this.appearanceValue = { characterTypeId: descriptor.id, outfitId: outfit.id };
    this.built = buildCharacter(descriptor, outfit);
    this.object.add(this.built.root);
    const previousClip = this.animator?.currentClip;
    this.animator = new CharacterAnimator(this.built.rig, previousClip && this.danceClip ? previousClip : descriptor.animations.idle);
    if (this.danceClip && !descriptor.animations.dances.includes(this.danceClip)) this.danceClip = null;
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

  dance(clip: AnimationClipId): void {
    this.danceClip = clip;
  }

  stopDancing(): void {
    this.danceClip = null;
  }

  moveWithVelocity(deltaSeconds: number, desiredVelocity: THREE.Vector3, space: WalkableSpace | null): void {
    this.velocity.copy(desiredVelocity);
    const speed = this.velocity.length();
    if (speed < 0.05) return;

    this.danceClip = null;
    this.position.addScaledVector(this.velocity, deltaSeconds);
    space?.constrain(this.position, this.radius);
    this.facing = angleTowards(this.facing, Math.atan2(this.velocity.x, this.velocity.z), turnSpeed * deltaSeconds);
    this.stridePhase += (speed * deltaSeconds * Math.PI) / (strideLength * this.built.descriptor.scale);
  }

  faceTowards(target: THREE.Vector3, deltaSeconds: number): void {
    const desired = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    this.facing = angleTowards(this.facing, desired, turnSpeed * 0.5 * deltaSeconds);
  }

  update(deltaSeconds: number, timing: ActorTiming): void {
    const moving = this.velocity.lengthSq() > 0.0025;
    const animations = this.built.descriptor.animations;
    this.animator.play(moving ? animations.walk : (this.danceClip ?? animations.idle));
    this.animator.update(deltaSeconds, { ...timing, stridePhase: this.stridePhase });
    this.object.rotation.y = this.facing;
    this.velocity.set(0, 0, 0);
  }

  dispose(): void {
    this.object.removeFromParent();
    this.label?.material.map?.dispose();
    this.label?.material.dispose();
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
