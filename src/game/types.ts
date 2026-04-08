export type DuelPhase = "idle" | "omen" | "strike-window" | "resolved" | "reset";

export type DuelOutcome = "pending" | "success" | "fail";

export interface DuelSnapshot {
  phase: DuelPhase;
  outcome: DuelOutcome;
  title: string;
  message: string;
  flash: string;
  flashVisible: boolean;
  canStrike: boolean;
}
