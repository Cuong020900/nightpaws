import { element } from "./dom.ts";

export function createJoystick(onMove: (x: number, y: number) => void): HTMLElement {
  const knob = element("div", { className: "joystick__knob" });
  const base = element("div", { className: "joystick", attributes: { "aria-label": "Move" } }, [knob]);
  let activePointer: number | null = null;

  const update = (event: PointerEvent) => {
    const bounds = base.getBoundingClientRect();
    const radius = bounds.width / 2;
    let x = (event.clientX - (bounds.left + radius)) / radius;
    let y = (event.clientY - (bounds.top + radius)) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    knob.style.transform = `translate(${x * radius * 0.55}px, ${y * radius * 0.55}px)`;
    onMove(x, -y);
  };

  const release = () => {
    activePointer = null;
    knob.style.transform = "";
    base.classList.remove("joystick--active");
    onMove(0, 0);
  };

  base.addEventListener("pointerdown", (event) => {
    activePointer = event.pointerId;
    base.setPointerCapture(event.pointerId);
    base.classList.add("joystick--active");
    update(event);
  });
  base.addEventListener("pointermove", (event) => {
    if (event.pointerId === activePointer) update(event);
  });
  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);
  return base;
}
