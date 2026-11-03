import type { RoomOccupancy } from "@nightpaws/shared";
import { element } from "./dom.ts";

export interface QueueScreenOptions {
  venueName: string;
  onLeave: () => void;
}

function ordinal(position: number): string {
  const tens = position % 100;
  if (tens >= 11 && tens <= 13) return `${position}th`;
  return `${position}${["th", "st", "nd", "rd"][position % 10] ?? "th"}`;
}

export class QueueScreen {
  readonly root: HTMLElement;
  private readonly position: HTMLElement;
  private readonly status: HTMLElement;
  private readonly compactText: HTMLElement;
  private readonly title: HTMLElement;

  constructor(options: QueueScreenOptions) {
    this.position = element("strong", { className: "queue-card__number", text: "1" });
    this.status = element("p", { className: "queue-card__status", attributes: { role: "status", "aria-live": "polite" } });
    const leave = element("button", { className: "chunky-button chunky-button--ghost", text: "Leave the line", attributes: { type: "button" } });
    leave.addEventListener("click", () => options.onLeave());
    const compactLeave = element("button", { className: "chip-button", text: "Leave line", attributes: { type: "button" } });
    compactLeave.addEventListener("click", () => options.onLeave());
    this.compactText = element("span", { className: "queue-banner__text" });
    this.title = element("h2", { className: "intro-card__venue", text: `${options.venueName} is packed` });

    const card = element("div", { className: "queue-card" }, [
      element("p", { className: "intro-card__eyebrow", text: "The line outside" }),
      this.title,
      element("div", { className: "queue-card__position" }, [element("span", { className: "queue-card__hash", text: "#" }), this.position]),
      this.status,
      element("p", { className: "queue-card__hint", text: "The bouncer walks you in automatically the moment someone leaves. Keep this tab open." }),
      leave,
    ]);
    const banner = element("div", { className: "queue-banner" }, [element("span", { className: "queue-banner__dot" }), this.compactText, compactLeave]);

    this.root = element("section", { className: "queue queue--hidden", attributes: { "aria-label": "Waiting line" } }, [card, banner]);
  }

  setVenueName(name: string): void {
    this.title.textContent = `${name} is packed`;
  }

  get isShown(): boolean {
    return !this.root.classList.contains("queue--hidden");
  }

  show(position: number, occupancy: RoomOccupancy, compact: boolean): void {
    this.root.classList.remove("queue--hidden");
    this.root.classList.toggle("queue--compact", compact);
    this.update(position, occupancy);
  }

  update(position: number, occupancy: RoomOccupancy): void {
    this.position.textContent = String(position);
    const waiting = occupancy.queued;
    this.status.textContent = `You're ${ordinal(position)} in line · ${occupancy.players}/${occupancy.capacity} inside · ${waiting} waiting`;
    this.compactText.textContent = `Club full — you're #${position} in line (${occupancy.players}/${occupancy.capacity} inside). Partying solo until then.`;
  }

  hide(): void {
    this.root.classList.add("queue--hidden");
  }
}
