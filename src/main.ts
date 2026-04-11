import "./styles.css";
import type { CombatSnapshot } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

type ElementOptions = {
  className?: string;
  textContent?: string;
  ariaLabel?: string;
  role?: string;
};

interface AppShellRefs {
  sceneRoot: HTMLDivElement;
  statusChip: HTMLElement;
  roundStat: HTMLElement;
  scoreStat: HTMLElement;
  streakStat: HTMLElement;
  missesStat: HTMLElement;
  roundValue: HTMLElement;
  scoreValue: HTMLElement;
  streakValue: HTMLElement;
  missesValue: HTMLElement;
  actionCue: HTMLElement;
}

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: ElementOptions = {}
) => {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.textContent) element.textContent = options.textContent;
  if (options.ariaLabel) element.setAttribute("aria-label", options.ariaLabel);
  if (options.role) element.setAttribute("role", options.role);
  return element;
};

const setHidden = (element: HTMLElement) => {
  element.setAttribute("aria-hidden", "true");
  return element;
};

const PLAYER_ATTACK_RANGE = 1.72;

const getDistanceToEnemy = (snapshot: CombatSnapshot) =>
  Math.hypot(snapshot.player.x - snapshot.enemy.x, snapshot.player.z - snapshot.enemy.z);

const getStatus = (snapshot: CombatSnapshot) => {
  if (snapshot.mode === "title") return "ready";
  if (snapshot.mode === "resolved") {
    if (snapshot.runComplete) return snapshot.result === "success" ? "clear" : "over";
    return snapshot.result === "success" ? "success" : "fail";
  }
  if (snapshot.enemy.vulnerable) return "open";
  if (snapshot.enemy.telegraphType !== "none") return snapshot.enemy.telegraphType;
  return "wait";
};

const getAction = (snapshot: CombatSnapshot) => {
  if (snapshot.mode === "title") return "start";
  if (snapshot.mode === "resolved") return snapshot.runComplete ? "restart" : "next";
  if (snapshot.enemy.vulnerable) {
    return getDistanceToEnemy(snapshot) <= PLAYER_ATTACK_RANGE ? "strike" : "approach";
  }
  if (snapshot.enemy.telegraphType === "dash") return "dash";
  if (snapshot.enemy.telegraphType === "sweep") return "sweep";
  if (snapshot.enemy.telegraphType === "slam") return "slam";
  return "wait";
};

const buildAppShell = (mountPoint: HTMLDivElement): AppShellRefs => {
  const shell = createElement("main", {
    className: "shell",
    role: "application",
    ariaLabel: "Moonlit Duel. Move with WASD or arrow keys. Strike with Space, click, or tap."
  });
  const stage = createElement("section", { className: "stage-shell" });
  const sceneRoot = createElement("div", { className: "stage-shell__canvas" });
  const overlay = createElement("div", { className: "overlay" });

  const brand = createElement("div", { className: "brand" });
  brand.setAttribute("aria-hidden", "true");
  const brandMark = createElement("span", { className: "brand__mark" });
  brandMark.append(
    createElement("span", { className: "brand__moon" }),
    createElement("span", { className: "brand__blade" })
  );
  brand.append(brandMark);

  const statusChip = createElement("div", {
    className: "state-chip",
    ariaLabel: "Ready",
    role: "status"
  });
  statusChip.append(
    setHidden(createElement("span", { className: "state-chip__halo" })),
    setHidden(createElement("span", { className: "state-chip__core" })),
    setHidden(createElement("span", { className: "state-chip__slash" }))
  );

  const stats = createElement("section", { className: "run-stats" });
  const createStat = (iconClass: string, value: string, ariaLabel: string) => {
    const item = createElement("p", { className: "run-stat", ariaLabel });
    const statIcon = setHidden(createElement("span", {
      className: `run-stat__icon run-stat__icon--${iconClass}`
    }));
    const statValue = createElement("strong", {
      className: "run-stat__value",
      textContent: value
    });
    item.append(statIcon, statValue);
    return { item, value: statValue };
  };
  const roundStat = createStat("round", "1/5", "Round 1 of 5");
  const scoreStat = createStat("score", "0", "Score 0");
  const streakStat = createStat("streak", "×1", "Streak 1");
  const missesStat = createStat("miss", "0/3", "Misses 0 of 3");
  stats.append(roundStat.item, scoreStat.item, streakStat.item, missesStat.item);

  const actionCue = createElement("div", {
    className: "next-action",
    ariaLabel: "Start",
    role: "status"
  });
  [
    "start",
    "side",
    "back",
    "in",
    "approach",
    "strike",
    "restart"
  ].forEach((name) => {
    actionCue.append(setHidden(createElement("span", {
      className: `cue-icon cue-icon--${name}`
    })));
  });

  const tutorial = createElement("div", { className: "tutorial-ghost" });
  tutorial.setAttribute("aria-hidden", "true");
  const ghostStick = createElement("div", { className: "ghost-stick" });
  ghostStick.append(createElement("span", { className: "ghost-stick__thumb" }));
  const ghostTap = createElement("div", { className: "ghost-tap" });
  ghostTap.append(createElement("span", { className: "ghost-tap__ring" }));
  const ghostKey = createElement("div", { className: "ghost-key" });
  tutorial.append(ghostStick, ghostTap, ghostKey);

  const arenaFrame = setHidden(createElement("div", { className: "arena-frame" }));

  overlay.append(brand, stats, statusChip, actionCue, tutorial, arenaFrame);
  stage.append(sceneRoot, overlay);
  shell.append(stage);
  mountPoint.replaceChildren(shell);

  return {
    sceneRoot,
    statusChip,
    roundStat: roundStat.item,
    scoreStat: scoreStat.item,
    streakStat: streakStat.item,
    missesStat: missesStat.item,
    roundValue: roundStat.value,
    scoreValue: scoreStat.value,
    streakValue: streakStat.value,
    missesValue: missesStat.value,
    actionCue
  };
};

const refs = buildAppShell(app);

const updateOverlay = (snapshot: CombatSnapshot) => {
  const status = getStatus(snapshot);
  const action = getAction(snapshot);

  refs.roundValue.textContent = `${snapshot.round}/${snapshot.maxRounds}`;
  refs.scoreValue.textContent = snapshot.score.toLocaleString("en-US");
  refs.streakValue.textContent = `×${Math.max(1, snapshot.streak)}`;
  refs.missesValue.textContent = `${snapshot.misses}/${snapshot.maxMisses}`;

  refs.roundStat.setAttribute("aria-label", `Round ${snapshot.round} of ${snapshot.maxRounds}`);
  refs.scoreStat.setAttribute("aria-label", `Score ${snapshot.score}`);
  refs.streakStat.setAttribute("aria-label", `Streak ${Math.max(1, snapshot.streak)}`);
  refs.missesStat.setAttribute("aria-label", `Misses ${snapshot.misses} of ${snapshot.maxMisses}`);
  refs.statusChip.dataset.status = status;
  refs.statusChip.setAttribute("aria-label", snapshot.title);
  refs.actionCue.dataset.action = action;
  refs.actionCue.setAttribute("aria-label", snapshot.nextAction);

  document.documentElement.dataset.mode = snapshot.mode;
  document.documentElement.dataset.result = snapshot.result;
  document.documentElement.dataset.runComplete = `${snapshot.runComplete}`;
  document.documentElement.dataset.enemy = snapshot.enemy.telegraphType;
  document.documentElement.dataset.status = status;
  document.documentElement.dataset.action = action;
};

const showFallback = () => {
  refs.sceneRoot.replaceChildren();
  refs.sceneRoot.classList.add("stage-shell__canvas--fallback");
  const fallback = createElement("section", {
    className: "fallback-panel",
    ariaLabel: "WebGL unavailable"
  });
  const fallbackIcon = setHidden(createElement("div", { className: "fallback-panel__icon" }));
  const button = createElement("button", {
    className: "fallback-panel__button",
    ariaLabel: "Reload"
  });
  button.setAttribute("type", "button");
  button.append(setHidden(createElement("span", { className: "fallback-panel__reload" })));
  button.addEventListener("click", () => window.location.reload());
  fallback.append(fallbackIcon, button);
  refs.sceneRoot.append(fallback);
  refs.statusChip.dataset.status = "webgl";
  refs.statusChip.setAttribute("aria-label", "WebGL unavailable");
  refs.actionCue.dataset.action = "restart";
  refs.actionCue.setAttribute("aria-label", "Reload or try another browser");
  document.documentElement.dataset.mode = "fallback";
  document.documentElement.dataset.status = "webgl";
  document.documentElement.dataset.action = "restart";
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
