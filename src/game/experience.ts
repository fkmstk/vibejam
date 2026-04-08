import { Vector2 } from "three";
import { DuelController } from "./duel";
import { createStageScene } from "./scene";
import type { DuelSnapshot, ViewportMode } from "./types";

interface ExperienceOptions {
  mount: HTMLElement;
  onStateChange: (snapshot: DuelSnapshot) => void;
}

export const createDuelExperience = ({
  mount,
  onStateChange
}: ExperienceOptions) => {
  const controller = new DuelController();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = createStageScene(mount, reducedMotion);
  const size = new Vector2();
  let viewportMode: ViewportMode = "desktop";

  const getSnapshot = (now = performance.now()) => controller.getSnapshot(now);

  const resize = () => {
    const bounds = mount.getBoundingClientRect();
    size.set(Math.max(bounds.width, 1), Math.max(bounds.height, 1));
    viewportMode =
      size.x < 720 || size.x / size.y < 0.95
        ? "portrait"
        : size.x < 1080 || size.x / size.y < 1.35
          ? "tablet"
          : "desktop";
    scene.resize(size);
  };

  resize();
  window.addEventListener("resize", resize);

  const renderFrame = (now: number) => {
    const snapshot = controller.getSnapshot(now);
    scene.render(
      {
        phase: snapshot.phase,
        outcome: snapshot.outcome,
        phaseElapsed: controller.getPhaseElapsed(now),
        phaseProgress: snapshot.phaseProgress,
        viewportMode
      },
      now
    );
    return snapshot;
  };

  renderFrame(performance.now());

  let frameId = 0;
  const frame = (now: number) => {
    const changed = controller.tick(now);
    const snapshot = renderFrame(now);

    if (changed) {
      onStateChange(snapshot);
    }

    frameId = window.requestAnimationFrame(frame);
  };

  frameId = window.requestAnimationFrame(frame);

  return {
    getSnapshot,
    attemptStrike: () => {
      const didStrike = controller.attemptStrike(performance.now());

      if (didStrike) {
        onStateChange(getSnapshot());
      }
    },
    destroy: () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      scene.dispose();
    }
  };
};
