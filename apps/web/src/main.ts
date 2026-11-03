import {
  apiRoutes,
  defaultSceneId,
  findSelectableCharacterType,
  outfits,
  type CharacterAppearance,
  type RoomOccupancy,
  type RoomSummary,
  type SceneDescriptor,
} from "@nightpaws/shared";
import { restorePlayer, savePlayer } from "./api/player-session.ts";
import { Game } from "./engine/game.ts";
import { preloadCharacterModels } from "./characters/model-library.ts";
import { RoomMusic } from "./music/room-music.ts";
import { RoomConnection, type ConnectionPhase, type JoinIdentity } from "./realtime/room-connection.ts";
import { playableScenes } from "./scenes/scene-registry.ts";
import "./styles.css";
import { showToast } from "./ui/dom.ts";
import { Hud } from "./ui/hud.ts";
import { IntroScreen } from "./ui/intro-screen.ts";
import { MusicRequestDialog } from "./ui/music-request-dialog.ts";
import { QueueScreen } from "./ui/queue-screen.ts";

const defaultAppearance: CharacterAppearance = { characterTypeId: "panda", outfitId: outfits[0]!.id };
const venueStorageKey = "nightpaws.venueId";
const roomPollMs = 10000;

function readStoredVenue(scenes: SceneDescriptor[]): SceneDescriptor | undefined {
  try {
    const id = localStorage.getItem(venueStorageKey);
    return scenes.find((scene) => scene.id === id);
  } catch {
    return undefined;
  }
}

function storeVenue(sceneId: string): void {
  try {
    localStorage.setItem(venueStorageKey, sceneId);
  } catch {
    return;
  }
}

async function waitForFonts(): Promise<void> {
  await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);
}

function describeRoom(room: RoomSummary | RoomOccupancy): string {
  const line = room.queued ? ` · ${room.queued} in line` : "";
  return `${room.players}/${room.capacity} inside${line}`;
}

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
  const uiRoot = document.querySelector<HTMLElement>("#ui-root")!;
  const loading = document.querySelector<HTMLElement>("#loading")!;
  const loadingText = loading.querySelector<HTMLElement>(".loading__text")!;
  const venues = playableScenes();
  const requestedVenue = new URLSearchParams(window.location.search).get("venue");
  const scene = venues.find((venue) => venue.id === requestedVenue) ?? readStoredVenue(venues) ?? venues.find((venue) => venue.id === defaultSceneId) ?? venues[0]!;

  const [savedPlayer] = await Promise.all([
    restorePlayer(),
    waitForFonts(),
    preloadCharacterModels((done, total) => {
      loadingText.textContent = `Loading the crowd… ${done}/${total}`;
    }),
  ]);
  let playerId = savedPlayer?.profile.id ?? null;
  let playerName = savedPlayer?.profile.displayName ?? "";
  const savedCharacter = savedPlayer?.activeCharacter;
  const initialAppearance = savedCharacter && findSelectableCharacterType(savedCharacter.characterTypeId)
    ? { characterTypeId: savedCharacter.characterTypeId, outfitId: savedCharacter.outfitId }
    : defaultAppearance;

  document.title = `Nightpaws · ${scene.displayName}`;
  const game = new Game({ canvas, sceneId: scene.id, playerName: playerName || "You", playerAppearance: initialAppearance });

  const toasts = document.createElement("div");
  toasts.className = "toasts";

  const dialog = new MusicRequestDialog(async (video) => {
    await music.request(video, playerName || "Guest", playerId);
    showToast(toasts, "Request sent to the DJ booth ♪");
  });

  const hud = new Hud({
    sceneName: scene.displayName,
    onJoystick: (x, y) => game.input.setJoystick(x, y),
    onRequestMusic: () => dialog.open(),
    onDance: (clip) => game.playEmote(clip),
    onCycleDance: (step) => game.cycleEmote(step),
    onFreezeCrowd: () => game.toggleCrowdFreeze(),
    onSyncCrowd: () => game.toggleCrowdSync(),
    onSit: () => game.toggleSit(),
    onHold: () => game.toggleHold(),
    onTalk: () => game.talk(),
    onToggleMute: () => music.toggleMute(),
    onChangeLook: () => {
      game.returnToIntro();
      hud.hide();
      intro.show();
    },
    onLeaveRoom: () => {
      connection.leave();
      queue.hide();
      game.returnToIntro();
      hud.hide();
      intro.show();
      void pollRooms();
    },
  });

  const music = new RoomMusic(scene.id, hud.playerHost, {
    onMusicState: (state) => {
      game.showMusicState(state);
      hud.showMusicState(state);
    },
    onPlaybackChange: (isPlaying) => {
      game.setMusicPlaying(isPlaying);
      hud.setPlaybackActive(isPlaying);
    },
    onMusicError: (message) => showToast(toasts, message, "error"),
  });

  let occupancy: RoomOccupancy | null = null;
  let waitingFromIntro = false;

  const enterPlaying = (name: string) => {
    intro.hide();
    hud.show(name, game.availableDances);
    if (game.currentMode !== "playing") game.enterWorld();
  };

  const refreshRoomStatus = (phase: ConnectionPhase) => {
    if (phase === "live" && occupancy) hud.setRoomStatus(`● Live · ${describeRoom(occupancy)}`, "live");
    else if (phase === "live") hud.setRoomStatus("● Live", "live");
    else if (phase === "queued") hud.setRoomStatus("In line · solo", "wait");
    else if (phase === "connecting" || phase === "retrying") hud.setRoomStatus("◌ Connecting…", "wait");
    else hud.setRoomStatus("Solo · offline", "off");
  };

  const queue = new QueueScreen({
    venueName: scene.displayName,
    onLeave: () => {
      connection.leave();
      queue.hide();
      if (waitingFromIntro) {
        waitingFromIntro = false;
        intro.show();
      }
    },
  });

  const connection: RoomConnection = new RoomConnection(
    scene.id,
    {
      onPhase: (phase) => {
        refreshRoomStatus(phase);
        game.setLiveRoom(phase === "live");
        music.setLive(phase === "live");
      },
      onWelcome: (welcome) => {
        occupancy = welcome.occupancy;
        game.remote.setTickInterval(welcome.tickMs);
        game.remote.reset(welcome.players, welcome.you);
        if (welcome.music) music.applyLiveState(welcome.music);
        refreshRoomStatus("live");
        const wasQueued = queue.isShown;
        queue.hide();
        if (waitingFromIntro) {
          waitingFromIntro = false;
          enterPlaying(playerName);
        }
        if (wasQueued) showToast(toasts, "You're in! Welcome to the party 🎉");
        else if (welcome.resumed) showToast(toasts, "Reconnected to the room");
        const others = welcome.players.length;
        if (!wasQueued && !welcome.resumed) showToast(toasts, others ? `${others} other ${others === 1 ? "player is" : "players are"} here` : "You're the first one here");
      },
      onQueued: (position, next) => {
        occupancy = next;
        const compact = game.currentMode === "playing";
        if (!compact) waitingFromIntro = true;
        intro.hide();
        queue.show(position, next, compact);
        refreshRoomStatus("queued");
      },
      onMessage: (message) => {
        const self = connection.you;
        switch (message.t) {
          case "join":
            if (message.player.id !== self) game.remote.upsert(message.player);
            return;
          case "leave":
            game.remote.remove(message.id);
            return;
          case "look":
            game.remote.setLook(message.id, message.name, message.look);
            return;
          case "tick":
            game.remote.applyDeltas(message.p, self);
            return;
          case "snapshot":
            game.remote.reset(message.players, self);
            return;
          case "music":
            music.applyLiveState(message.state);
            return;
          case "occupancy":
            occupancy = message;
            refreshRoomStatus(connection.phase);
            return;
          case "correct":
            game.correctPlayerPosition(message.x, message.z);
            return;
          case "error":
            showToast(toasts, message.message, "error");
        }
      },
      onStopped: (reason) => {
        showToast(toasts, reason, "error");
        queue.hide();
        if (waitingFromIntro) {
          waitingFromIntro = false;
          intro.show();
          intro.setMessage(reason);
        }
      },
    },
    () => game.playerPose,
  );
  game.onPlayerJump = () => connection.jump();

  const intro: IntroScreen = new IntroScreen({
    scenes: venues,
    initialSceneId: scene.id,
    initialName: playerName,
    initialAppearance,
    onAppearanceChange: (appearance) => game.setPlayerAppearance(appearance),
    onNameChange: (name) => game.setPlayerName(name),
    onSceneChange: (sceneId) => {
      game.loadScene(sceneId);
      music.switchRoom(sceneId);
      connection.switchRoom(sceneId);
      const venueName = game.scene.descriptor.displayName;
      hud.setSceneName(venueName);
      queue.setVenueName(venueName);
      document.title = `Nightpaws · ${venueName}`;
      storeVenue(sceneId);
      void pollRooms();
    },
    onEnter: async (name, appearance) => {
      playerName = name;
      game.setPlayerName(name);
      game.setPlayerAppearance(appearance);
      const playbackReady = music.startPlayback();
      try {
        const saved = await savePlayer(name, appearance);
        playerId = saved.profile.id;
      } catch {
        showToast(toasts, "Couldn't reach the server — your look won't be saved.", "error");
      }
      const identity: JoinIdentity = { name, look: appearance, playerId };
      const outcome = await connection.join(identity);
      if (outcome === "stopped") throw new Error("The bouncer turned you away. Try again in a few minutes.");
      if (outcome === "offline") showToast(toasts, "Can't reach the club server — partying solo while we keep trying.", "error");
      if (outcome !== "queued") enterPlaying(name);
      await playbackReady.catch(() => showToast(toasts, "YouTube player failed to load.", "error"));
    },
  });

  const pollRooms = async () => {
    if (!intro.isShown) return;
    const roomId = game.scene.descriptor.id;
    try {
      const response = await fetch(apiRoutes.rooms);
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { rooms: RoomSummary[] };
      const room = body.rooms.find((candidate) => candidate.id === roomId);
      if (roomId === game.scene.descriptor.id) intro.setRoomStatus(room ? `● ${describeRoom(room)}` : "");
    } catch {
      intro.setRoomStatus("Club server offline · you can still party solo");
    }
  };
  void pollRooms();
  window.setInterval(() => void pollRooms(), roomPollMs);

  game.input.onKeyPress((code) => {
    if (code === "KeyM" && game.currentMode === "playing") dialog.open();
    if (code === "KeyH" && game.currentMode === "playing" && hud.isShown) hud.toggleConcealed();
  });
  window.setInterval(() => {
    hud.setActiveDance(game.activeDance);
    hud.setCrowdMode(game.crowdMode, game.crowdMove);
    hud.setPlayerActions(game.playerActions);
  }, 150);

  uiRoot.append(intro.root, queue.root, hud.root, dialog.root, toasts);
  game.start();
  loading.classList.add("loading--done");
  void music.connect();
}

void boot().catch((error: unknown) => {
  const loadingText = document.querySelector<HTMLElement>("#loading .loading__text");
  if (loadingText) loadingText.textContent = `Couldn't open the club: ${error instanceof Error ? error.message : String(error)}`;
});
