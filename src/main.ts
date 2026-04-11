import "./styles.css";
import type { CombatSnapshot } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

type ElementOptions = {
  className?: string;
  textContent?: string;
};

interface AppShellRefs {
  sceneRoot: HTMLDivElement;
  titleLabel: HTMLElement;
  subtitleLabel: HTMLElement;
  hintLabel: HTMLElement;
  resultChip: HTMLElement;
  roundValue: HTMLElement;
  scoreValue: HTMLElement;
  streakValue: HTMLElement;
  missesValue: HTMLElement;
  actionLabel: HTMLElement;
  footerLabel: HTMLElement;
}

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: ElementOptions = {}
) => {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.textContent) element.textContent = options.textContent;
  return element;
};

const buildAppShell = (mountPoint: HTMLDivElement): AppShellRefs => {
  const shell = createElement("main", { className: "shell" });
  const stage = createElement("section", { className: "stage-shell" });
  const sceneRoot = createElement("div", { className: "stage-shell__canvas" });
  const overlay = createElement("div", { className: "overlay" });

  const brand = createElement("div", { className: "brand" });
  const brandMark = createElement("span", {
    className: "brand__mark",
    textContent: "刀"
  });
  const brandName = createElement("span", {
    className: "brand__name",
    textContent: "Moonlit Duel"
  });
  brand.append(brandMark, brandName);

  const hero = createElement("section", { className: "hero" });
  const titleLabel = createElement("h1", {
    className: "hero__title",
    textContent: "月下ノ刃"
  });
  const subtitleLabel = createElement("p", {
    className: "hero__subtitle",
    textContent: "Move / Tap で開戦"
  });
  const hintLabel = createElement("p", {
    className: "hero__hint",
    textContent: "WASD / Arrow で移動  Space / Click / Tap で斬る"
  });
  hero.append(titleLabel, subtitleLabel, hintLabel);

  const resultChip = createElement("p", {
    className: "result-chip",
    textContent: "決闘中"
  });

  const stats = createElement("section", { className: "run-stats" });
  const createStat = (label: string, value: string) => {
    const item = createElement("p", { className: "run-stat" });
    const statLabel = createElement("span", {
      className: "run-stat__label",
      textContent: label
    });
    const statValue = createElement("strong", {
      className: "run-stat__value",
      textContent: value
    });
    item.append(statLabel, statValue);
    return { item, value: statValue };
  };
  const roundStat = createStat("ROUND", "1/5");
  const scoreStat = createStat("SCORE", "0");
  const streakStat = createStat("STREAK", "0");
  const missesStat = createStat("MISS", "0/3");
  stats.append(roundStat.item, scoreStat.item, streakStat.item, missesStat.item);

  const actionLabel = createElement("p", {
    className: "next-action",
    textContent: "Move / Tap で開戦"
  });

  const touchGuide = createElement("div", { className: "touch-guide" });
  const moveGuide = createElement("span", {
    className: "touch-guide__zone touch-guide__zone--move",
    textContent: "左: 移動"
  });
  const strikeGuide = createElement("span", {
    className: "touch-guide__zone touch-guide__zone--strike",
    textContent: "右: 斬る"
  });
  touchGuide.append(moveGuide, strikeGuide);

  const footer = createElement("footer", { className: "footer" });
  const footerLabel = createElement("p", {
    className: "footer__label",
    textContent: "敵の予兆を見て、正しい方向へ外せ"
  });
  footer.append(footerLabel);

  overlay.append(brand, hero, stats, resultChip, actionLabel, touchGuide, footer);
  stage.append(sceneRoot, overlay);
  shell.append(stage);
  mountPoint.replaceChildren(shell);

  return {
    sceneRoot,
    titleLabel,
    subtitleLabel,
    hintLabel,
    resultChip,
    roundValue: roundStat.value,
    scoreValue: scoreStat.value,
    streakValue: streakStat.value,
    missesValue: missesStat.value,
    actionLabel,
    footerLabel
  };
};

const refs = buildAppShell(app);

const updateOverlay = (snapshot: CombatSnapshot) => {
  refs.titleLabel.textContent = snapshot.title;
  refs.subtitleLabel.textContent = snapshot.subtitle;
  refs.hintLabel.textContent = snapshot.hint;
  refs.roundValue.textContent = `${snapshot.round}/${snapshot.maxRounds}`;
  refs.scoreValue.textContent = snapshot.score.toLocaleString("en-US");
  refs.streakValue.textContent = `x${Math.max(1, snapshot.streak)}`;
  refs.missesValue.textContent = `${snapshot.misses}/${snapshot.maxMisses}`;
  refs.actionLabel.textContent = snapshot.nextAction;
  refs.footerLabel.textContent =
    snapshot.mode === "combat"
      ? `ROUND ${snapshot.round}: ${snapshot.nextAction}`
      : snapshot.runComplete
        ? snapshot.result === "success"
          ? "五連斬り。まぁ悪くないじゃん"
          : "三度斬られた。次は見切りなよ"
        : snapshot.result === "success"
          ? "避けて刺した。次、来るよ"
          : snapshot.result === "fail"
            ? "今の太刀筋、覚えたでしょ"
            : "赤を外して、白い隙を斬れ";

  refs.resultChip.textContent =
    snapshot.mode === "title"
      ? "READY"
      : snapshot.mode === "combat"
        ? snapshot.enemy.vulnerable
          ? "OPEN"
          : `ROUND ${snapshot.round}`
        : snapshot.runComplete
          ? snapshot.result === "success"
            ? "CLEAR"
            : "GAME OVER"
          : snapshot.result === "success"
            ? "NEXT"
            : "MISS";

  document.documentElement.dataset.mode = snapshot.mode;
  document.documentElement.dataset.result = snapshot.result;
  document.documentElement.dataset.runComplete = `${snapshot.runComplete}`;
  document.documentElement.dataset.enemy = snapshot.enemy.telegraphType;
};

const showFallback = () => {
  refs.sceneRoot.replaceChildren();
  refs.sceneRoot.classList.add("stage-shell__canvas--fallback");
  const fallback = createElement("section", { className: "fallback-panel" });
  const label = createElement("p", {
    className: "fallback-panel__label",
    textContent: "3D描画が起きなかった"
  });
  const title = createElement("h2", {
    className: "fallback-panel__title",
    textContent: "赤を避けて、白い隙を斬る"
  });
  const body = createElement("p", {
    className: "fallback-panel__body",
    textContent:
      "この端末のWebGLが眠ってるだけ。GPU設定を変えるか、別ブラウザで開けば勝負できるじゃん。"
  });
  const button = createElement("button", {
    className: "fallback-panel__button",
    textContent: "Reload"
  });
  button.addEventListener("click", () => window.location.reload());
  fallback.append(label, title, body, button);
  refs.sceneRoot.append(fallback);
  refs.resultChip.textContent = "WEBGL";
  refs.actionLabel.textContent = "再読み込み / 別ブラウザ";
  refs.footerLabel.textContent = "空画面で終わらせないくらいはしてるの";
  document.documentElement.dataset.mode = "fallback";
};

const bootstrap = async () => {
  try {
    const { createDuelExperience } = await import("./game/experience");
    const experience = createDuelExperience({
      mount: refs.sceneRoot,
      onStateChange: updateOverlay
    });

    updateOverlay(experience.getSnapshot());
  } catch (error) {
    console.error("Failed to start Moonlit Duel", error);
    showFallback();
  }
};

void bootstrap();
