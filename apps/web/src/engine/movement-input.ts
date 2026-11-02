import * as THREE from "three";

const movementKeys: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export class MovementInput {
  private readonly pressed = new Set<string>();
  private readonly joystick = new THREE.Vector2();
  private readonly keyListeners = new Set<(code: string) => void>();

  constructor() {
    window.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.code in movementKeys) {
        this.pressed.add(event.code);
        event.preventDefault();
      }
      if (!event.repeat) for (const listener of this.keyListeners) listener(event.code);
    });
    window.addEventListener("keyup", (event) => this.pressed.delete(event.code));
    window.addEventListener("blur", () => this.pressed.clear());
  }

  setJoystick(x: number, y: number): void {
    this.joystick.set(x, y);
  }

  onKeyPress(listener: (code: string) => void): () => void {
    this.keyListeners.add(listener);
    return () => this.keyListeners.delete(listener);
  }

  readIntent(target: THREE.Vector2): THREE.Vector2 {
    target.set(0, 0);
    for (const code of this.pressed) {
      const [x, y] = movementKeys[code]!;
      target.x += x;
      target.y += y;
    }
    target.add(this.joystick);
    if (target.lengthSq() > 1) target.normalize();
    return target;
  }
}
