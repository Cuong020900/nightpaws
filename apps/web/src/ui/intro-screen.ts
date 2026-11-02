import {
  characterTypes,
  displayNameLimits,
  normalizeDisplayName,
  outfits,
  type CharacterAppearance,
  type SceneDescriptor,
} from "@nightpaws/shared";
import { element } from "./dom.ts";

export interface IntroScreenOptions {
  scene: SceneDescriptor;
  initialName: string;
  initialAppearance: CharacterAppearance;
  onAppearanceChange: (appearance: CharacterAppearance) => void;
  onNameChange: (name: string) => void;
  onEnter: (name: string, appearance: CharacterAppearance) => Promise<void>;
}

export class IntroScreen {
  readonly root: HTMLElement;
  private appearance: CharacterAppearance;
  private readonly nameInput: HTMLInputElement;
  private readonly enterButton: HTMLButtonElement;
  private readonly message: HTMLElement;
  private readonly characterButtons = new Map<string, HTMLButtonElement>();
  private readonly outfitButtons = new Map<string, HTMLButtonElement>();

  constructor(private readonly options: IntroScreenOptions) {
    this.appearance = { ...options.initialAppearance };

    this.nameInput = element("input", {
      className: "neon-input",
      attributes: {
        id: "display-name-input",
        type: "text",
        maxlength: String(displayNameLimits.max),
        placeholder: "Your party name",
        autocomplete: "off",
        spellcheck: "false",
        "aria-label": "Display name",
      },
    });
    this.nameInput.value = options.initialName;
    this.nameInput.addEventListener("input", () => {
      options.onNameChange(this.nameInput.value.trim() || "You");
      this.message.textContent = "";
    });
    this.nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") void this.submit();
    });

    const characterGrid = element(
      "div",
      { className: "choice-grid" },
      characterTypes.map((characterType) => {
        const swatches = element("span", { className: "character-card__swatches" }, [
          element("i", { style: { background: characterType.basePalette.fur } }),
          element("i", { style: { background: characterType.basePalette.furSecondary } }),
          element("i", { style: { background: characterType.basePalette.belly } }),
        ]);
        const button = element("button", { className: "character-card", attributes: { type: "button" } }, [
          swatches,
          element("strong", { text: characterType.displayName }),
          element("small", { text: characterType.tagline }),
        ]);
        button.addEventListener("click", () => this.choose({ characterTypeId: characterType.id }));
        this.characterButtons.set(characterType.id, button);
        return button;
      }),
    );

    const outfitRow = element(
      "div",
      { className: "outfit-row" },
      outfits.map((outfit) => {
        const button = element("button", {
          className: "outfit-chip",
          attributes: { type: "button", title: outfit.displayName, "aria-label": outfit.displayName },
          style: {
            background: `linear-gradient(135deg, ${outfit.colors.outfit} 0 55%, ${outfit.colors.outfitTrim} 55% 78%, ${outfit.colors.accent} 78%)`,
          },
        });
        button.addEventListener("click", () => this.choose({ outfitId: outfit.id }));
        this.outfitButtons.set(outfit.id, button);
        return button;
      }),
    );

    this.enterButton = element("button", { className: "chunky-button chunky-button--hero", text: "Enter the club", attributes: { type: "submit" } });
    this.message = element("p", { className: "intro__message", attributes: { role: "status" } });

    const form = element("form", { className: "intro-card" }, [
      element("p", { className: "intro-card__eyebrow", text: "Tonight at" }),
      element("h2", { className: "intro-card__venue", text: options.scene.displayName }),
      element("label", { className: "field-label", text: "Display name", attributes: { for: "display-name-input" } }),
      this.nameInput,
      element("p", { className: "field-label", text: "Character" }),
      characterGrid,
      element("p", { className: "field-label", text: "Outfit" }),
      outfitRow,
      this.enterButton,
      this.message,
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submit();
    });

    this.root = element("section", { className: "intro" }, [
      element("header", { className: "intro__brand" }, [
        element("h1", { className: "logo", text: "NIGHTPAWS" }),
        element("p", { className: "intro__tagline", text: options.scene.tagline }),
      ]),
      form,
    ]);
    this.refreshSelection();
  }

  show(): void {
    this.root.classList.remove("intro--hidden");
    this.enterButton.disabled = false;
  }

  hide(): void {
    this.root.classList.add("intro--hidden");
  }

  private choose(change: Partial<CharacterAppearance>): void {
    this.appearance = { ...this.appearance, ...change };
    this.refreshSelection();
    this.options.onAppearanceChange(this.appearance);
  }

  private refreshSelection(): void {
    for (const [id, button] of this.characterButtons) {
      button.classList.toggle("is-selected", id === this.appearance.characterTypeId);
    }
    for (const [id, button] of this.outfitButtons) button.classList.toggle("is-selected", id === this.appearance.outfitId);
  }

  private async submit(): Promise<void> {
    const name = normalizeDisplayName(this.nameInput.value);
    if (!name) {
      this.message.textContent = `Pick a name with ${displayNameLimits.min}–${displayNameLimits.max} characters.`;
      this.nameInput.focus();
      return;
    }
    this.enterButton.disabled = true;
    this.message.textContent = "Getting you past the bouncer…";
    try {
      await this.options.onEnter(name, this.appearance);
      this.message.textContent = "";
    } catch (error) {
      this.message.textContent = error instanceof Error ? error.message : "Something went wrong.";
    } finally {
      this.enterButton.disabled = false;
    }
  }
}
