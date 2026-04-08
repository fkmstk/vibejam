import "./styles.css";
import type { DuelSnapshot } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

type ElementOptions = {
  className?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  dataset?: Record<string, string>;
};

interface AppShellRefs {
  sceneRoot: HTMLDivElement;
  heroCallout: HTMLElement;
  phaseLabel: HTMLElement;
  windowLabel: HTMLElement;
  statusTitle: HTMLElement;
  statusText: HTMLElement;
  keyHint: HTMLElement;
  resultFlash: HTMLElement;
}


const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: ElementOptions = {}
) => {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.textContent) {
    element.textContent = options.textContent;
  }

  if (options.attributes) {
    for (const [name, value] of Object.entries(options.attributes)) {
      element.setAttribute(name, value);
    }
  }

  if (options.dataset) {
    for (const [name, value] of Object.entries(options.dataset)) {
      element.dataset[name] = value;
    }
  }

  return element;
};

const buildAppShell = (mountPoint: HTMLDivElement): AppShellRefs => {
  const main = createElement("main", { className: "shell" });
  const experience = createElement("section", { className: "experience" });
  main.append(experience);

  const topRail = createElement("header", { className: "top-rail" });
  const topRailMark = createElement("span", {
    className: "top-rail__mark",
    textContent: "刀"
  });
  topRail.append(topRailMark);

  const stageShell = createElement("section", { className: "stage-shell" });
  const sceneRoot = createElement("div", {
    className: "stage-shell__canvas",
    dataset: { sceneRoot: "" }
  });
  const stageOverlay = createElement("div", { className: "stage-shell__overlay" });

  const heroCopy = createElement("div", { className: "hero-copy" });

  const title = createElement("h1", { className: "title" });
  title.append(
    createElement("span", {
      className: "title__jp",
      textContent: "月下ノ刃"
    })
  );
  const heroCallout = createElement("p", {
    className: "hero-callout",
    textContent: "待って、赤で斬れ。"
  });
  heroCopy.append(title, heroCallout);

  const hud = createElement("div", {
    className: "hud",
    attributes: { "aria-live": "polite" }
  });
  const hudRow = createElement("div", { className: "hud__row" });

  const phaseLabel = createElement("strong", {
    textContent: "Idle",
    dataset: { phaseLabel: "" }
  });
  const windowLabel = createElement("strong", {
    textContent: "Wait",
    dataset: { windowLabel: "" }
  });

  const createHudChip = (
    label: string,
    value: HTMLElement,
    accent = false
  ) => {
    const chip = createElement("div", {
      className: accent ? "hud__chip hud__chip--accent" : "hud__chip"
    });
    chip.append(
      createElement("span", {
        className: "hud__label",
        textContent: label
      }),
      value
    );
    return chip;
  };

  hudRow.append(
    createHudChip("Phase", phaseLabel),
    createHudChip("Window", windowLabel, true)
  );

  const hudBottom = createElement("div", { className: "hud__bottom" });
  const hudStatus = createElement("div", { className: "hud__status" });
  const statusTitle = createElement("p", {
    className: "hud__status-title",
    textContent: "静観",
    dataset: { statusTitle: "" }
  });
  const statusText = createElement("p", {
    className: "hud__status-text",
    textContent: "深紅の合図を待て。",
    dataset: { statusText: "" }
  });
  hudStatus.append(statusTitle, statusText);

  const keyHint = createElement("p", {
    className: "key-hint",
    textContent: "Tap / Space",
    dataset: { inputHint: "" }
  });

  hudBottom.append(hudStatus, keyHint);
  hud.append(hudRow, hudBottom);

  const resultFlash = createElement("p", {
    className: "result-flash",
    textContent: "一閃",
    dataset: { resultFlash: "" }
  });

  stageOverlay.append(heroCopy, resultFlash, hud);
  stageShell.append(sceneRoot, stageOverlay);

  experience.append(topRail, stageShell);
  mountPoint.replaceChildren(main);
  return {
    sceneRoot,
    heroCallout,
    phaseLabel,
    windowLabel,
    statusTitle,
    statusText,
    keyHint,
    resultFlash
  };
};

const { sceneRoot, heroCallout, phaseLabel, windowLabel, statusTitle, statusText, keyHint, resultFlash } =
  buildAppShell(app);

const phaseCopy: Record<DuelSnapshot["phase"], string> = {
  idle: "Idle",
  omen: "Omen",
  "strike-window": "Strike",
  resolved: "Resolved",
  reset: "Reset"
};

const updateOverlay = (snapshot: DuelSnapshot) => {
  phaseLabel.textContent = phaseCopy[snapshot.phase];
  windowLabel.textContent = snapshot.canStrike ? "Now" : "Closed";
  statusTitle.textContent = snapshot.title;
  statusText.textContent = snapshot.message;
  heroCallout.textContent = snapshot.callout;
  keyHint.textContent = snapshot.inputHint;
  resultFlash.textContent = snapshot.flash;
  resultFlash.dataset.visible = snapshot.flashVisible ? "true" : "false";
  document.documentElement.dataset.phase = snapshot.phase;
  document.documentElement.dataset.outcome = snapshot.outcome;
  document.documentElement.dataset.emphasis = snapshot.emphasis;
  document.documentElement.style.setProperty("--phase-progress", snapshot.phaseProgress.toFixed(3));
};

const bootstrap = async () => {
  const { createDuelExperience } = await import("./game/experience");

  const experience = createDuelExperience({
    mount: sceneRoot,
    onStateChange: updateOverlay
  });

  updateOverlay(experience.getSnapshot());

  const attemptStrike = () => {
    experience.attemptStrike();
  };

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      attemptStrike();
    }
  });

  sceneRoot.addEventListener("pointerdown", attemptStrike);
};

void bootstrap();
