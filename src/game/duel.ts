import type { DuelEmphasis, DuelOutcome, DuelPhase, DuelSnapshot } from "./types";

const phaseDurations: Record<DuelPhase, number> = {
  idle: 0.7,
  omen: 0.8,
  "strike-window": 0.45,
  resolved: 0.95,
  reset: 0.55
};

const phaseText: Record<DuelPhase, Pick<DuelSnapshot, "title" | "message" | "flash" | "callout">> = {
  idle: {
    title: "静観",
    message: "待て。赤で斬れ。",
    flash: "静",
    callout: "待って、赤で斬れ。"
  },
  omen: {
    title: "予兆",
    message: "まだ待て。",
    flash: "兆",
    callout: "赤が満ちるまで、まだ待て。"
  },
  "strike-window": {
    title: "抜刀",
    message: "今、斬れ。",
    flash: "斬",
    callout: "今だけ斬れる。"
  },
  resolved: {
    title: "決着",
    message: "一太刀で決まった。",
    flash: "決",
    callout: "一撃で、勝敗が決まる。"
  },
  reset: {
    title: "余韻",
    message: "次の合図を待て。",
    flash: "寂",
    callout: "次の一瞬を待て。"
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

  getSnapshot(now = performance.now()): DuelSnapshot {
    const copy = phaseText[this.phase];
    const successFlash = this.outcome === "success" ? "一閃" : "被";
    const resolvedFailure = "早すぎるか遅すぎた。敵の太刀を許した。";
    const resolvedSuccess = "赤の瞬間を捉えた。敵の気配が崩れる。";
    const emphasis = this.getEmphasis();

    return {
      phase: this.phase,
      outcome: this.outcome,
      title:
        this.outcome === "success"
          ? "成功"
          : this.outcome === "fail" && this.phase === "resolved"
            ? "失敗"
            : copy.title,
      message:
        this.outcome === "success"
          ? resolvedSuccess
          : this.outcome === "fail" && this.phase === "resolved"
            ? resolvedFailure
            : copy.message,
      callout:
        this.outcome === "success"
          ? "赤を捉えた。一閃で崩せ。"
          : this.outcome === "fail" && this.phase === "resolved"
            ? "早いか遅い。赤を待て。"
            : copy.callout,
      flash: this.outcome === "pending" ? copy.flash : successFlash,
      flashVisible: this.outcome !== "pending" || this.phase === "strike-window",
      canStrike: this.phase === "strike-window",
      inputHint: "Tap / Space",
      phaseProgress: this.getPhaseProgress(now),
      emphasis
    };
  }

  getPhaseElapsed(now: number): number {
    return Math.max(0, (now - this.phaseStartedAt) / 1000);
  }

  getPhaseProgress(now: number): number {
    return Math.min(1, this.getPhaseElapsed(now) / phaseDurations[this.phase]);
  }

  getPhaseDuration(phase: DuelPhase): number {
    return phaseDurations[phase];
  }

  private resolve(outcome: DuelOutcome, now: number) {
    this.outcome = outcome;
    this.setPhase("resolved", now);
  }

  private setPhase(phase: DuelPhase, now: number) {
    this.phase = phase;
    this.phaseStartedAt = now;
  }

  private getEmphasis(): DuelEmphasis {
    if (this.phase === "resolved" && this.outcome === "success") {
      return "success";
    }

    if (this.phase === "resolved" && this.outcome === "fail") {
      return "fail";
    }

    if (this.phase === "strike-window") {
      return "strike";
    }

    if (this.phase === "omen") {
      return "warning";
    }

    return "calm";
  }
}
