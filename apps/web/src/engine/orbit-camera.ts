import * as THREE from "three";

export interface OrbitLimits {
  minDistance: number;
  maxDistance: number;
  minPitch: number;
  maxPitch: number;
}

const followLimits: OrbitLimits = { minDistance: 3.5, maxDistance: 16, minPitch: 0.12, maxPitch: 1.35 };
const dragSensitivity = 0.005;

export class OrbitCamera {
  yaw = 0;
  pitch = 0.42;
  distance = 8.5;
  private readonly focus = new THREE.Vector3();
  private readonly desiredFocus = new THREE.Vector3();
  private readonly activePointers = new Map<number, THREE.Vector2>();
  private pinchDistance = 0;
  private limits = followLimits;
  enabled = true;
  constrain: ((focus: THREE.Vector3, camera: THREE.Vector3) => void) | null = null;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    surface: HTMLElement,
  ) {
    surface.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      surface.setPointerCapture(event.pointerId);
      this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      this.pinchDistance = this.currentPinchDistance();
    });
    surface.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    const release = (event: PointerEvent) => {
      this.activePointers.delete(event.pointerId);
      this.pinchDistance = this.currentPinchDistance();
    };
    surface.addEventListener("pointerup", release);
    surface.addEventListener("pointercancel", release);
    surface.addEventListener(
      "wheel",
      (event) => {
        if (!this.enabled) return;
        event.preventDefault();
        this.zoomBy(Math.exp(event.deltaY * 0.0012));
      },
      { passive: false },
    );
  }

  get forwardOnGround(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  get rightOnGround(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  follow(target: THREE.Vector3, height: number): void {
    this.desiredFocus.set(target.x, target.y + height, target.z);
  }

  snapToFocus(): void {
    this.focus.copy(this.desiredFocus);
  }

  update(deltaSeconds: number): void {
    this.focus.lerp(this.desiredFocus, 1 - Math.exp(-deltaSeconds * 8));
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * horizontal,
      this.focus.y + Math.sin(this.pitch) * this.distance,
      this.focus.z + Math.cos(this.yaw) * horizontal,
    );
    this.constrain?.(this.focus, this.camera.position);
    this.camera.lookAt(this.focus);
  }

  private zoomBy(factor: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance * factor, this.limits.minDistance, this.limits.maxDistance);
  }

  private handlePointerMove(event: PointerEvent): void {
    const previous = this.activePointers.get(event.pointerId);
    if (!previous || !this.enabled) return;
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    previous.set(event.clientX, event.clientY);

    if (this.activePointers.size >= 2) {
      const pinch = this.currentPinchDistance();
      if (this.pinchDistance > 0 && pinch > 0) this.zoomBy(this.pinchDistance / pinch);
      this.pinchDistance = pinch;
      return;
    }

    this.yaw -= deltaX * dragSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + deltaY * dragSensitivity, this.limits.minPitch, this.limits.maxPitch);
  }

  private currentPinchDistance(): number {
    const points = [...this.activePointers.values()];
    if (points.length < 2) return 0;
    return points[0]!.distanceTo(points[1]!);
  }
}
