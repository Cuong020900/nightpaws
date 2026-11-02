import * as THREE from "three";

const keyIntensity = 6;
const rimIntensity = 14;
const up = new THREE.Vector3(0, 1, 0);

export class FocusLights {
  readonly object = new THREE.Group();
  private readonly key = new THREE.SpotLight(0xfff0e0, 0, 0, 0.32, 0.6, 1.3);
  private readonly rim = new THREE.SpotLight(0xffffff, 0, 0, 0.35, 0.6, 1.3);
  private readonly offset = new THREE.Vector3();
  private active = false;

  constructor() {
    this.object.add(this.key, this.key.target, this.rim, this.rim.target);
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  update(deltaSeconds: number, subject: THREE.Vector3, facing: number, height: number, rimColor: THREE.Color): void {
    const blend = 1 - Math.exp(-deltaSeconds * 4);
    this.key.intensity = THREE.MathUtils.lerp(this.key.intensity, this.active ? keyIntensity : 0, blend);
    this.rim.intensity = THREE.MathUtils.lerp(this.rim.intensity, this.active ? rimIntensity : 0, blend);
    const visible = this.key.intensity > 0.05;
    this.key.visible = this.rim.visible = visible;
    if (!visible) return;
    const target = this.offset.copy(subject).addScaledVector(up, height * 0.6);
    this.key.target.position.copy(target);
    this.rim.target.position.copy(target);
    this.key.position.copy(subject).add(new THREE.Vector3(-1.8, 3.6, 2.6).applyAxisAngle(up, facing));
    this.rim.position.copy(subject).add(new THREE.Vector3(0.6, 3.2, -2.6).applyAxisAngle(up, facing));
    this.rim.color.copy(rimColor).lerp(new THREE.Color(1, 1, 1), 0.3);
    this.key.target.updateMatrixWorld();
    this.rim.target.updateMatrixWorld();
  }
}
