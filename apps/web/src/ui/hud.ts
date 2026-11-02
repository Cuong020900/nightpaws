import type { AnimationClipId, RoomMusicState } from "@nightpaws/shared";
import { danceDisplayNames } from "../characters/animation-clips.ts";
import { element } from "./dom.ts";
import { createJoystick } from "./joystick.ts";

export interface HudOptions {
  sceneName: string;
  onJoystick: (x: number, y: number) => void;
  onRequestMusic: () => void;
  onDance: (clip: AnimationClipId) => void;
  onToggleMute: () => boolean;
  onChangeLook: () => void;
}

export class Hud {
  readonly root: HTMLElement;
  readonly playerHost: HTMLElement;
  private readonly playerName: HTMLElement;
  private readonly trackTitle: HTMLElement;
  private readonly trackMeta: HTMLElement;
  private readonly monitor: HTMLElement;
  private readonly danceButtons: HTMLElement;
  private readonly danceButtonMap = new Map<AnimationClipId, HTMLButtonElement>();

  constructor(private readonly options: HudOptions) {
    this.playerName = element("strong", { className: "player-chip__name" });
    const changeLook = element("button", { className: "chip-button", text: "Change look", attributes: { type: "button" } });
    changeLook.addEventListener("click", () => options.onChangeLook());
    const playerChip = element("div", { className: "player-chip" }, [
      element("span", { className: "player-chip__venue", text: options.sceneName }),
      this.playerName,
      changeLook,
    ]);

    this.playerHost = element("div", { className: "monitor__screen" });
    this.trackTitle = element("strong", { className: "monitor__title", text: "Nothing playing" });
    this.trackMeta = element("span", { className: "monitor__meta", text: "Request a track to get the party going" });
    const muteButton = element("button", { className: "icon-button", text: "🔊", attributes: { type: "button", "aria-label": "Mute music" } });
    muteButton.addEventListener("click", () => {
      const audible = options.onToggleMute();
      muteButton.textContent = audible ? "🔊" : "🔇";
    });
    const collapseButton = element("button", { className: "icon-button", text: "▾", attributes: { type: "button", "aria-label": "Collapse player" } });
    collapseButton.addEventListener("click", () => {
      const collapsed = this.monitor.classList.toggle("monitor--collapsed");
      collapseButton.textContent = collapsed ? "▸" : "▾";
    });
    this.monitor = element("aside", { className: "monitor monitor--idle" }, [
      element("div", { className: "monitor__header" }, [
        element("span", { className: "monitor__badge", text: "♪ DJ booth" }),
        muteButton,
        collapseButton,
      ]),
      this.playerHost,
      element("div", { className: "monitor__info" }, [this.trackTitle, this.trackMeta]),
    ]);

    const requestButton = element("button", { className: "action-button action-button--music", attributes: { type: "button" } }, [
      element("span", { className: "action-button__icon", text: "♪" }),
      element("span", { text: "Request" }),
    ]);
    requestButton.addEventListener("click", () => options.onRequestMusic());
    this.danceButtons = element("div", { className: "dance-buttons" });

    this.root = element("div", { className: "hud hud--hidden" }, [
      playerChip,
      this.monitor,
      element("div", { className: "hud__joystick" }, [createJoystick(options.onJoystick)]),
      element("div", { className: "hud__actions" }, [this.danceButtons, requestButton]),
      element("p", { className: "hud__hint", text: "Drag to look · WASD or joystick to move · 1-3 to dance" }),
    ]);
  }

  show(playerName: string, dances: AnimationClipId[]): void {
    this.playerName.textContent = playerName;
    this.setDances(dances);
    this.root.classList.remove("hud--hidden");
  }

  hide(): void {
    this.root.classList.add("hud--hidden");
  }

  setActiveDance(active: AnimationClipId | null): void {
    for (const [clip, button] of this.danceButtonMap) button.classList.toggle("is-active", clip === active);
  }

  setPlaybackActive(isPlaying: boolean): void {
    this.monitor.classList.toggle("monitor--live", isPlaying);
  }

  showMusicState(state: RoomMusicState | null): void {
    const nowPlaying = state?.nowPlaying ?? null;
    this.monitor.classList.toggle("monitor--idle", !nowPlaying);
    if (!nowPlaying) {
      this.trackTitle.textContent = state ? "Nothing playing" : "DJ booth offline";
      this.trackMeta.textContent = state ? "Request a track to get the party going" : "Start the server to request music";
      return;
    }
    this.trackTitle.textContent = nowPlaying.request.title ?? `YouTube · ${nowPlaying.request.videoId}`;
    const queued = state!.queue.length;
    this.trackMeta.textContent = `requested by ${nowPlaying.request.requestedBy}${queued ? ` · ${queued} up next` : ""}`;
  }

  private setDances(dances: AnimationClipId[]): void {
    this.danceButtons.replaceChildren();
    this.danceButtonMap.clear();
    dances.forEach((clip, index) => {
      const button = element("button", { className: "action-button action-button--dance", attributes: { type: "button" } }, [
        element("span", { className: "action-button__key", text: String(index + 1) }),
        element("span", { text: danceDisplayNames[clip] }),
      ]);
      button.addEventListener("click", () => this.options.onDance(clip));
      this.danceButtonMap.set(clip, button);
      this.danceButtons.append(button);
    });
  }
}
