export type DuelPhase = "idle" | "omen" | "strike-window" | "resolved" | "reset";

export type DuelOutcome = "pending" | "success" | "fail";

export type DuelEmphasis = "calm" | "warning" | "strike" | "success" | "fail";

export type ViewportMode = "desktop" | "tablet" | "portrait";

export interface DuelSnapshot {
  phase: DuelPhase;
  outcome: DuelOutcome;
  title: string;
  message: string;
  callout: string;
  flash: string;
  flashVisible: boolean;
  canStrike: boolean;
  inputHint: string;
  phaseProgress: number;
  emphasis: DuelEmphasis;
}
