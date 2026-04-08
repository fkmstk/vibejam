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

const buildAppShell = (mountPoint: HTMLDivElement) => {
  const main = createElement("main", { className: "shell" });
  const experience = createElement("section", { className: "experience" });
  main.append(experience);

  const topRail = createElement("header", { className: "top-rail" });
  const topRailSeal = createElement("div", { className: "top-rail__seal" });
  const topRailMark = createElement("span", {
    className: "top-rail__mark",
    textContent: "刀"
  });
  const topRailCopy = createElement("div");
  topRailCopy.append(
    createElement("p", {
      className: "top-rail__label",
      textContent: "Moonlit Counter Prototype"
    }),
    createElement("p", {
      className: "top-rail__value",
      textContent: "Vibe Coding Game Jam 2026"
    })
  );
  topRailSeal.append(topRailMark, topRailCopy);

  const topRailTrack = createElement("div", {
    className: "top-rail__track",
    attributes: { "aria-label": "project status" }
  });
  for (const label of ["Three.js / WebGL", "One Slash Loop", "Mobile Ready"]) {
    topRailTrack.append(createElement("span", { textContent: label }));
  }

  topRail.append(topRailSeal, topRailTrack);

  const stageShell = createElement("section", { className: "stage-shell" });
  const stageCanvas = createElement("div", {
    className: "stage-shell__canvas",
    dataset: { sceneRoot: "" }
  });
  const stageOverlay = createElement("div", { className: "stage-shell__overlay" });

  const heroCopy = createElement("div", { className: "hero-copy" });
  heroCopy.append(
    createElement("p", {
      className: "eyebrow",
      textContent: "Ink / Steel / Crimson Signal"
    })
  );

  const title = createElement("h1", { className: "title" });
  title.append(
    createElement("span", {
      className: "title__jp",
      textContent: "月下ノ刃"
    }),
    createElement("span", {
      className: "title__en",
      textContent: "GEKKA NO YAIBA"
    })
  );
  heroCopy.append(
    title,
    createElement("p", {
      className: "hook",
      textContent: "赤く灯った瞬間だけ、斬れる。"
    })
  );

  const ruleChips = createElement("div", {
    className: "rule-chips",
    attributes: { "aria-label": "core rules" }
  });
  for (const chip of ["敵が赤く灯る", "一拍だけ待つ", "一太刀で決める"]) {
    ruleChips.append(createElement("span", { className: "rule-chip", textContent: chip }));
  }
  heroCopy.append(ruleChips);

  const hud = createElement("div", {
    className: "hud",
    attributes: { "aria-live": "polite" }
  });
  const hudRow = createElement("div", { className: "hud__row" });

  const phaseStrong = createElement("strong", {
    textContent: "Idle",
    dataset: { phaseLabel: "" }
  });
  const windowStrong = createElement("strong", {
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
    createHudChip("Phase", phaseStrong),
    createHudChip("Window", windowStrong, true)
  );

  const resultFlashNode = createElement("p", {
    className: "result-flash",
    textContent: "一閃",
    dataset: { resultFlash: "" }
  });

  const hudBottom = createElement("div", { className: "hud__bottom" });
  const hudStatus = createElement("div", { className: "hud__status" });
  const statusTitleNode = createElement("p", {
    className: "hud__status-title",
    textContent: "静観",
    dataset: { statusTitle: "" }
  });
  const statusTextNode = createElement("p", {
    className: "hud__status-text",
    textContent: "深紅の合図を待て。早撃ちは負け。",
    dataset: { statusText: "" }
  });
  hudStatus.append(
    createElement("p", {
      className: "hud__eyebrow",
      textContent: "Counter Read"
    }),
    statusTitleNode,
    statusTextNode
  );

  const hudActions = createElement("div", { className: "hud__actions" });
  const strikeAction = createElement("button", {
    className: "button button--primary",
    textContent: "抜刀する",
    attributes: { type: "button" },
    dataset: { action: "strike" }
  });
  hudActions.append(
    strikeAction,
    createElement("p", {
      className: "input-hint",
      textContent: "Tap / Click / Space"
    })
  );

  hudBottom.append(hudStatus, hudActions);
  hud.append(hudRow, resultFlashNode, hudBottom);

  stageOverlay.append(heroCopy, hud);
  stageShell.append(stageCanvas, stageOverlay);

  const proofStrip = createElement("section", {
    className: "proof-strip",
    attributes: { "aria-label": "project strengths" }
  });
  const proofCards = [
    ["01", "3D Counter Slice", "DOM演出じゃなく、WebGLシーン上で赤予兆を読む。"],
    ["02", "One Input Duel", "1入力で勝敗が決まる、短く尖ったプレイサイクル。"],
    ["03", "Lightweight Stage", "重い後処理なしで、月光と墨の立体感だけ残す。"]
  ] as const;

  for (const [index, titleText, body] of proofCards) {
    const card = createElement("article", { className: "proof-card" });
    card.append(
      createElement("p", {
        className: "proof-card__index",
        textContent: index
      }),
      createElement("p", {
        className: "proof-card__title",
        textContent: titleText
      }),
      createElement("p", {
        className: "proof-card__text",
        textContent: body
      })
    );
    proofStrip.append(card);
  }

  experience.append(topRail, stageShell, proofStrip);
  mountPoint.replaceChildren(main);
};

buildAppShell(app);

const sceneRoot = document.querySelector<HTMLElement>("[data-scene-root]");
const strikeButton = document.querySelector<HTMLButtonElement>("[data-action='strike']");
const phaseLabel = document.querySelector<HTMLElement>("[data-phase-label]");
const windowLabel = document.querySelector<HTMLElement>("[data-window-label]");
const statusTitle = document.querySelector<HTMLElement>("[data-status-title]");
const statusText = document.querySelector<HTMLElement>("[data-status-text]");
const resultFlash = document.querySelector<HTMLElement>("[data-result-flash]");

if (
  !sceneRoot ||
  !strikeButton ||
  !phaseLabel ||
  !windowLabel ||
  !statusTitle ||
  !statusText ||
  !resultFlash
) {
  throw new Error("UI elements were not found.");
}

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
  resultFlash.textContent = snapshot.flash;
  resultFlash.dataset.visible = snapshot.flashVisible ? "true" : "false";
  document.documentElement.dataset.phase = snapshot.phase;
  document.documentElement.dataset.outcome = snapshot.outcome;
};

strikeButton.disabled = true;

const bootstrap = async () => {
  const { createDuelExperience } = await import("./game/experience");

  const experience = createDuelExperience({
    mount: sceneRoot,
    onStateChange: updateOverlay
  });

  updateOverlay(experience.getSnapshot());
  strikeButton.disabled = false;

  sceneRoot.addEventListener("pointerdown", () => {
    experience.attemptStrike();
  });

  strikeButton.addEventListener("click", () => {
    experience.attemptStrike();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space") {
      return;
    }

    event.preventDefault();
    experience.attemptStrike();
  });
};

void bootstrap();
