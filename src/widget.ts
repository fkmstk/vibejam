const VIBE_JAM_WIDGET_URL = "https://vibej.am/2026/widget.js";
const VIBE_JAM_WIDGET_INTEGRITY =
  "sha384-D7uwKvjfCtcKdFoytvkFeDfWZWaJnZZPUhtSylGDSjnnV/Eh7MF2qV5cg3/lji5r";

const WIDGET_SELECTOR = 'script[data-vibe-jam-widget="true"]';

const shouldLoadWidget = () => import.meta.env.PROD && window.location.hostname !== "localhost";

const appendWidgetScript = () => {
  if (document.querySelector(WIDGET_SELECTOR)) {
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = VIBE_JAM_WIDGET_URL;
  script.crossOrigin = "anonymous";
  script.integrity = VIBE_JAM_WIDGET_INTEGRITY;
  script.referrerPolicy = "strict-origin-when-cross-origin";
  script.dataset.vibeJamWidget = "true";
  script.addEventListener("error", () => {
    console.warn("Vibe Jam widget failed integrity or network checks.");
  });

  document.head.append(script);
};

export const scheduleVibeJamWidget = () => {
  if (!shouldLoadWidget()) {
    return;
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => {
      appendWidgetScript();
    });
    return;
  }

  globalThis.setTimeout(() => {
    appendWidgetScript();
  }, 1);
};
