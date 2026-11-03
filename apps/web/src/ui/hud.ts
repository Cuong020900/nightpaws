import { danceMoveName, type DanceMoveId, type RoomMusicState } from "@nightpaws/shared";
import type { PlayerActionState } from "../actors/player-actions.ts";
import { danceHotkeyLabel } from "../engine/dance-hotkeys.ts";
import type { CrowdMode } from "../engine/game.ts";
import { element } from "./dom.ts";
import { createJoystick } from "./joystick.ts";

export interface HudOptions {
  sceneName: string;
  onJoystick: (x: number, y: number) => void;
  onRequestMusic: () => void;
  onDance: (clip: DanceMoveId) => void;
  onCycleDance: (step: number) => void;
  onFreezeCrowd: () => void;
  onSyncCrowd: () => void;
  onSit: () => void;
  onHold: () => void;
  onTalk: () => void;
  onToggleMute: () => boolean;
  onChangeLook: () => void;
  onLeaveRoom: () => void;
}

export class Hud {
  readonly root: HTMLElement;
  readonly playerHost: HTMLElement;
  private readonly playerName: HTMLElement;
  private readonly venueName: HTMLElement;
  private readonly roomStatus: HTMLElement;
  private readonly trackTitle: HTMLElement;
  private readonly trackMeta: HTMLElement;
  private readonly monitor: HTMLElement;
  private readonly danceButtons: HTMLElement;
  private readonly danceButtonMap = new Map<DanceMoveId, HTMLButtonElement>();
  private readonly concealButton: HTMLButtonElement;
  private readonly freezeButton: HTMLButtonElement;
  private readonly syncButton: HTMLButtonElement;
  private readonly sitButton: HTMLButtonElement;
  private readonly holdButton: HTMLButtonElement;
  private readonly talkButton: HTMLButtonElement;

  constructor(private readonly options: HudOptions) {
    this.playerName = element("strong", { className: "player-chip__name" });
    const changeLook = element("button", { className: "chip-button", text: "Look & venue", attributes: { type: "button" } });
    changeLook.addEventListener("click", () => options.onChangeLook());
    this.venueName = element("span", { className: "player-chip__venue", text: options.sceneName });
    const leaveRoom = element("button", { className: "chip-button", text: "Leave", attributes: { type: "button", "aria-label": "Leave the club" } });
    leaveRoom.addEventListener("click", () => options.onLeaveRoom());
    this.roomStatus = element("span", { className: "player-chip__room player-chip__room--off", text: "Solo", attributes: { role: "status" } });
    const playerChip = element("div", { className: "player-chip" }, [
      this.venueName,
      this.playerName,
      this.roomStatus,
      changeLook,
      leaveRoom,
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
    const cycleButton = (step: number, text: string, label: string) => {
      const button = element("button", { className: "chip-button dance-cycle__button", text, attributes: { type: "button", "aria-label": label } });
      button.addEventListener("click", () => options.onCycleDance(step));
      return button;
    };
    this.freezeButton = element("button", { className: "chip-button crowd-control__button crowd-control__button--freeze", text: "❄ Freeze · F", attributes: { type: "button", "aria-pressed": "false" } });
    this.freezeButton.addEventListener("click", () => options.onFreezeCrowd());
    this.syncButton = element("button", { className: "chip-button crowd-control__button crowd-control__button--sync", text: "⚡ All dance · G", attributes: { type: "button", "aria-pressed": "false" } });
    this.syncButton.addEventListener("click", () => options.onSyncCrowd());
    const actionButton = (text: string, action: () => void) => {
      const button = element("button", { className: "chip-button crowd-control__button player-action", text, attributes: { type: "button", "aria-pressed": "false" } });
      button.addEventListener("click", (event) => {
        action();
        (event.currentTarget as HTMLButtonElement).blur();
      });
      return button;
    };
    this.sitButton = actionButton("🪑 Sit · R", options.onSit);
    this.holdButton = actionButton("☕ Hold · Y", options.onHold);
    this.talkButton = actionButton("💬 Talk · T", options.onTalk);
    const dancePanel = element("div", { className: "dance-panel" }, [
      element("div", { className: "crowd-control player-actions" }, [
        element("span", { className: "dance-cycle__label", text: "You" }),
        this.sitButton,
        this.holdButton,
        this.talkButton,
      ]),
      element("div", { className: "crowd-control" }, [
        element("span", { className: "dance-cycle__label", text: "Crowd" }),
        this.freezeButton,
        this.syncButton,
      ]),
      element("div", { className: "dance-cycle" }, [
        cycleButton(-1, "◀ Q", "Previous dance"),
        element("span", { className: "dance-cycle__label", text: "Dances" }),
        cycleButton(1, "E ▶", "Next dance"),
      ]),
      this.danceButtons,
    ]);

    this.concealButton = element("button", { className: "chip-button hud__toggle", text: "Hide UI · H", attributes: { type: "button", "aria-pressed": "false" } });
    this.concealButton.addEventListener("click", () => this.toggleConcealed());

    this.root = element("div", { className: "hud hud--hidden" }, [
      playerChip,
      this.concealButton,
      element("div", { className: "hud__joystick" }, [createJoystick(options.onJoystick)]),
      element("div", { className: "hud__rail" }, [
        this.monitor,
        element("div", { className: "hud__actions" }, [dancePanel, requestButton]),
      ]),
      element("p", { className: "hud__hint", text: "Drag to look · WASD or joystick to move · Space to jump · R sit · Y hold a drink · T talk · 1-0, Z-N to dance · Q/E to cycle · F freezes the crowd · G makes everyone dance your move · H hides UI" }),
    ]);
  }

  show(playerName: string, dances: DanceMoveId[]): void {
    this.playerName.textContent = playerName;
    this.setDances(dances);
    this.root.classList.remove("hud--hidden");
  }

  hide(): void {
    this.root.classList.add("hud--hidden");
  }

  setSceneName(name: string): void {
    this.venueName.textContent = name;
  }

  get isShown(): boolean {
    return !this.root.classList.contains("hud--hidden");
  }

  toggleConcealed(): void {
    const concealed = this.root.classList.toggle("hud--concealed");
    this.concealButton.textContent = concealed ? "Show UI · H" : "Hide UI · H";
    this.concealButton.setAttribute("aria-pressed", String(concealed));
  }

  setActiveDance(active: DanceMoveId | null): void {
    for (const [clip, button] of this.danceButtonMap) button.classList.toggle("is-active", clip === active);
  }

  setCrowdMode(mode: CrowdMode, move: DanceMoveId | null): void {
    const frozen = mode === "freeze";
    const synced = mode === "sync";
    this.freezeButton.classList.toggle("is-active", frozen);
    this.freezeButton.setAttribute("aria-pressed", String(frozen));
    this.freezeButton.textContent = frozen ? "❄ Release · F" : "❄ Freeze · F";
    this.syncButton.classList.toggle("is-active", synced);
    this.syncButton.setAttribute("aria-pressed", String(synced));
    this.syncButton.textContent = synced && move ? `⚡ All: ${danceMoveName(move)} · G` : "⚡ All dance · G";
  }

  setPlayerActions(state: PlayerActionState): void {
    this.setAction(this.sitButton, state.seated, state.seatNearby, state.seated ? "🪑 Stand · R" : "🪑 Sit · R");
    this.setAction(this.holdButton, state.holding, state.drinkNearby, state.holding ? "☕ Drop · Y" : state.drinkNearby ? "☕ Grab drink · Y" : "☕ Hold · Y");
    this.setAction(this.talkButton, state.talking, false, "💬 Talk · T");
  }

  private setAction(button: HTMLButtonElement, active: boolean, ready: boolean, text: string): void {
    button.classList.toggle("is-active", active);
    button.classList.toggle("is-ready", ready && !active);
    button.setAttribute("aria-pressed", String(active));
    if (button.textContent !== text) button.textContent = text;
  }

  setRoomStatus(text: string, tone: "live" | "wait" | "off"): void {
    this.roomStatus.textContent = text;
    this.roomStatus.className = `player-chip__room player-chip__room--${tone}`;
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

  private setDances(dances: DanceMoveId[]): void {
    this.danceButtons.replaceChildren();
    this.danceButtonMap.clear();
    dances.forEach((clip, index) => {
      const button = element("button", { className: "action-button action-button--dance", attributes: { type: "button" } }, [
        element("span", { className: "action-button__key", text: danceHotkeyLabel(index) }),
        element("span", { text: danceMoveName(clip) }),
      ]);
      button.addEventListener("click", () => this.options.onDance(clip));
      this.danceButtonMap.set(clip, button);
      this.danceButtons.append(button);
    });
  }
}
