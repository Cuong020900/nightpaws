export interface DanceHotkey {
  code: string;
  label: string;
}

const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Z", "X", "C", "V", "B", "N"];

export const danceHotkeys: DanceHotkey[] = labels.map((label) => ({ label, code: /\d/.test(label) ? `Digit${label}` : `Key${label}` }));

export const danceCycleKeys: Record<string, number> = { KeyQ: -1, KeyE: 1 };

export const playerActionKeys = { sit: "KeyR", talk: "KeyT", hold: "KeyY" } as const;

export function danceHotkeyLabel(index: number): string {
  return danceHotkeys[index]?.label ?? "";
}
