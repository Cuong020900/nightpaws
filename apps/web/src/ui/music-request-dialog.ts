import { extractYouTubeVideoId } from "@nightpaws/shared";
import { element } from "./dom.ts";

export interface QuickPick {
  label: string;
  video: string;
}

export const quickPicks: QuickPick[] = [
  { label: "Synthwave radio", video: "https://www.youtube.com/watch?v=4xDzrJKXOOY" },
  { label: "Gangnam Style", video: "https://www.youtube.com/watch?v=9bZkp7q19f0" },
  { label: "Never gonna give…", video: "https://youtu.be/dQw4w9WgXcQ" },
];

export class MusicRequestDialog {
  readonly root: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly message: HTMLElement;

  constructor(private readonly onSubmit: (video: string) => Promise<void>) {
    this.input = element("input", {
      className: "neon-input",
      attributes: {
        id: "music-request-input",
        type: "text",
        placeholder: "Paste a YouTube link or video id",
        autocomplete: "off",
        spellcheck: "false",
      },
    });
    this.submitButton = element("button", { className: "chunky-button", text: "Send to DJ", attributes: { type: "submit" } });
    this.message = element("p", { className: "dialog__message", attributes: { role: "status" } });

    const picks = element(
      "div",
      { className: "quick-picks" },
      quickPicks.map((pick) => {
        const button = element("button", { className: "quick-pick", text: pick.label, attributes: { type: "button" } });
        button.addEventListener("click", () => {
          this.input.value = pick.video;
          this.input.focus();
        });
        return button;
      }),
    );

    const closeButton = element("button", { className: "icon-button dialog__close", text: "✕", attributes: { type: "button", "aria-label": "Close" } });
    closeButton.addEventListener("click", () => this.close());

    const form = element("form", { className: "dialog-card" }, [
      closeButton,
      element("h2", { className: "dialog-card__title", text: "Request a track" }),
      element("p", { className: "dialog-card__hint", text: "The DJ plays requests in order for everyone in the club." }),
      element("label", { className: "field-label", text: "YouTube link", attributes: { for: "music-request-input" } }),
      this.input,
      picks,
      this.submitButton,
      this.message,
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submit();
    });

    this.root = element("div", { className: "dialog dialog--hidden", attributes: { role: "dialog", "aria-modal": "true" } }, [form]);
    this.root.addEventListener("pointerdown", (event) => {
      if (event.target === this.root) this.close();
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
    });
  }

  open(): void {
    this.root.classList.remove("dialog--hidden");
    this.message.textContent = "";
    this.input.focus();
  }

  close(): void {
    this.root.classList.add("dialog--hidden");
    this.input.blur();
  }

  private async submit(): Promise<void> {
    const video = this.input.value.trim();
    if (!extractYouTubeVideoId(video)) {
      this.message.textContent = "That doesn't look like a YouTube link.";
      return;
    }
    this.submitButton.disabled = true;
    this.message.textContent = "Passing it to the DJ…";
    try {
      await this.onSubmit(video);
      this.input.value = "";
      this.close();
    } catch (error) {
      this.message.textContent = error instanceof Error ? error.message : "The DJ couldn't take that request.";
    } finally {
      this.submitButton.disabled = false;
    }
  }
}
