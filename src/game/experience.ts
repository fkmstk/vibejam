import { Vector2 } from "three";
import { DuelController } from "./duel";
import { createStageScene } from "./scene";
import type { DuelSnapshot } from "./types";

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

  const resize = () => {
    const bounds = mount.getBoundingClientRect();
    size.set(Math.max(bounds.width, 1), Math.max(bounds.height, 1));
    scene.resize(size);
  };

  resize();
  window.addEventListener("resize", resize);

  let frameId = 0;
  const frame = (now: number) => {
    const changed = controller.tick(now);
    const snapshot = controller.getSnapshot();
    scene.render(
      {
        phase: snapshot.phase,
        outcome: snapshot.outcome,
        phaseElapsed: controller.getPhaseElapsed(now)
      },
      now
    );

    if (changed) {
      onStateChange(snapshot);
    }

    frameId = window.requestAnimationFrame(frame);
  };

  frameId = window.requestAnimationFrame(frame);

  return {
    getSnapshot: () => controller.getSnapshot(),
    attemptStrike: () => {
      const didStrike = controller.attemptStrike(performance.now());

      if (didStrike) {
        onStateChange(controller.getSnapshot());
      }
    },
    destroy: () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      scene.dispose();
    }
  };
};
