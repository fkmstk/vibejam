import type { DuelOutcome, DuelPhase, DuelSnapshot } from "./types";

const phaseDurations: Record<DuelPhase, number> = {
  idle: 1.5,
  omen: 0.8,
  "strike-window": 0.4,
  resolved: 0.95,
  reset: 0.55
};

const phaseText: Record<DuelPhase, Pick<DuelSnapshot, "title" | "message" | "flash">> = {
  idle: {
    title: "静観",
    message: "深紅の合図を待て。早撃ちは負け。",
    flash: "静"
  },
  omen: {
    title: "予兆",
    message: "敵の間合いが詰まる。まだ抜くな。",
    flash: "兆"
  },
  "strike-window": {
    title: "抜刀",
    message: "今だけ斬れる。ためらうな。",
    flash: "斬"
  },
  resolved: {
    title: "決着",
    message: "一太刀で勝敗が決まった。",
    flash: "決"
  },
  reset: {
    title: "余韻",
    message: "呼吸を戻して、次の一瞬を待つ。",
    flash: "寂"
  }
};

export class DuelController {
  private phase: DuelPhase = "idle";
  private outcome: DuelOutcome = "pending";
  private phaseStartedAt = performance.now();

  tick(now: number): boolean {
    const elapsed = (now - this.phaseStartedAt) / 1000;

    if (this.phase === "idle" && elapsed >= phaseDurations.idle) {
      this.setPhase("omen", now);
      return true;
    }

    if (this.phase === "omen" && elapsed >= phaseDurations.omen) {
      this.setPhase("strike-window", now);
      return true;
    }

    if (this.phase === "strike-window" && elapsed >= phaseDurations["strike-window"]) {
      this.resolve("fail", now);
      return true;
    }

    if (this.phase === "resolved" && elapsed >= phaseDurations.resolved) {
      this.setPhase("reset", now);
      return true;
    }

    if (this.phase === "reset" && elapsed >= phaseDurations.reset) {
      this.outcome = "pending";
      this.setPhase("idle", now);
      return true;
    }

    return false;
  }

  attemptStrike(now: number): boolean {
    if (this.phase === "resolved" || this.phase === "reset") {
      return false;
    }

    if (this.phase === "strike-window") {
      this.resolve("success", now);
      return true;
    }

    this.resolve("fail", now);
    return true;
  }

  getSnapshot(): DuelSnapshot {
    const copy = phaseText[this.phase];
    const successFlash = this.outcome === "success" ? "一閃" : "被";
    const failureText =
      this.outcome === "success"
        ? "赤の瞬間を捉えた。敵の気配が崩れる。"
        : this.phase === "resolved"
          ? "早すぎるか遅すぎた。敵の太刀を許した。"
          : copy.message;

    return {
      phase: this.phase,
      outcome: this.outcome,
      title: this.outcome === "success" ? "成功" : this.outcome === "fail" && this.phase === "resolved" ? "失敗" : copy.title,
      message: failureText,
      flash: this.outcome === "pending" ? copy.flash : successFlash,
      flashVisible: this.outcome !== "pending" || this.phase === "strike-window",
      canStrike: this.phase === "strike-window"
    };
  }

  getPhaseElapsed(now: number): number {
    return Math.max(0, (now - this.phaseStartedAt) / 1000);
  }

  private resolve(outcome: DuelOutcome, now: number) {
    this.outcome = outcome;
    this.setPhase("resolved", now);
  }

  private setPhase(phase: DuelPhase, now: number) {
    this.phase = phase;
    this.phaseStartedAt = now;
  }
}
