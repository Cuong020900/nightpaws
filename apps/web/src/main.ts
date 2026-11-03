import { defaultSceneId, findSelectableCharacterType, outfits, type CharacterAppearance, type SceneDescriptor } from "@nightpaws/shared";
import { restorePlayer, savePlayer } from "./api/player-session.ts";
import { Game } from "./engine/game.ts";
import { preloadCharacterModels } from "./characters/model-library.ts";
import { RoomMusic } from "./music/room-music.ts";
import { playableScenes } from "./scenes/scene-registry.ts";
import "./styles.css";
import { showToast } from "./ui/dom.ts";
import { Hud } from "./ui/hud.ts";
import { IntroScreen } from "./ui/intro-screen.ts";
import { MusicRequestDialog } from "./ui/music-request-dialog.ts";

const defaultAppearance: CharacterAppearance = { characterTypeId: "panda", outfitId: outfits[0]!.id };
const venueStorageKey = "nightpaws.venueId";

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
    onToggleMute: () => music.toggleMute(),
    onChangeLook: () => {
      game.returnToIntro();
      hud.hide();
      intro.show();
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
      hud.setSceneName(game.scene.descriptor.displayName);
      document.title = `Nightpaws · ${game.scene.descriptor.displayName}`;
      storeVenue(sceneId);
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
      intro.hide();
      hud.show(name, game.availableDances);
      game.enterWorld();
      await playbackReady.catch(() => showToast(toasts, "YouTube player failed to load.", "error"));
    },
  });

  game.input.onKeyPress((code) => {
    if (code === "KeyM" && game.currentMode === "playing") dialog.open();
    if (code === "KeyH" && game.currentMode === "playing" && hud.isShown) hud.toggleConcealed();
  });
  window.setInterval(() => {
    hud.setActiveDance(game.activeDance);
    hud.setCrowdMode(game.crowdMode, game.crowdMove);
  }, 150);

  uiRoot.append(intro.root, hud.root, dialog.root, toasts);
  game.start();
  loading.classList.add("loading--done");
  void music.connect();
}

void boot().catch((error: unknown) => {
  const loadingText = document.querySelector<HTMLElement>("#loading .loading__text");
  if (loadingText) loadingText.textContent = `Couldn't open the club: ${error instanceof Error ? error.message : String(error)}`;
});
