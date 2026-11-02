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

const capturedKeys = new Set(["Space"]);

interface KeyboardLayoutSource {
  getLayoutMap?: () => Promise<Map<string, string>>;
}

function isPrintedCharacter(key: string): boolean {
  return [...key].length === 1;
}

export class MovementInput {
  capturing = false;
  private readonly pressed = new Set<string>();
  private readonly joystick = new THREE.Vector2();
  private readonly keyListeners = new Set<(code: string) => void>();
  private layout: Map<string, string> | null = null;

  constructor() {
    (navigator as Navigator & { keyboard?: KeyboardLayoutSource }).keyboard?.getLayoutMap?.()
      .then((layout) => (this.layout = layout))
      .catch(() => undefined);
    window.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.code in movementKeys) {
        if (this.isPhysicalPress(event)) this.pressed.add(event.code);
        event.preventDefault();
      }
      if (this.capturing && capturedKeys.has(event.code)) event.preventDefault();
      if (!event.repeat) for (const listener of this.keyListeners) listener(event.code);
    });
    window.addEventListener("keyup", (event) => {
      this.pressed.delete(event.code);
      if (this.capturing && capturedKeys.has(event.code) && !isTypingTarget(event.target)) event.preventDefault();
    });
    window.addEventListener("blur", () => this.pressed.clear());
    document.addEventListener("visibilitychange", () => this.pressed.clear());
  }

  releaseKeys(): void {
    this.pressed.clear();
  }

  private isPhysicalPress(event: KeyboardEvent): boolean {
    if (event.isComposing || event.keyCode === 229) return false;
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    if (!event.code.startsWith("Key")) return event.key === event.code;
    if (!isPrintedCharacter(event.key)) return false;
    const typed = event.key.toLowerCase();
    if (typed.charCodeAt(0) > 0x7f) return false;
    const expected = this.layout?.get(event.code) ?? event.code.slice(3).toLowerCase();
    return typed === expected.toLowerCase();
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
