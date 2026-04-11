import { Vector2 } from "three";
import { CombatController, renderCombatSnapshotToText } from "./duel";
import { createStageScene } from "./scene";
import type { CombatInput, CombatSnapshot, ViewportMode } from "./types";

interface ExperienceOptions {
  mount: HTMLElement;
  onStateChange: (snapshot: CombatSnapshot) => void;
}

interface PointerStickState {
  pointerId: number;
  centerX: number;
  centerY: number;
  currentX: number;
  currentY: number;
}

const FIXED_STEP = 1 / 60;

type SfxName = "telegraph" | "slash" | "success" | "fail";

const createSfxController = () => {
  let context: AudioContext | null = null;
  let unlocked = false;

  const ensureContext = () => {
    if (!context) {
      context = new AudioContext();
    }
    if (context.state === "suspended") {
      void context.resume();
    }
    unlocked = true;
    return context;
  };

  const playTone = (name: SfxName) => {
    if (!unlocked) return;
    const audio = ensureContext();
    const now = audio.currentTime;
    const gain = audio.createGain();
    const oscillator = audio.createOscillator();
    oscillator.type = name === "telegraph" ? "sine" : name === "slash" ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(
      name === "telegraph" ? 88 : name === "slash" ? 360 : name === "success" ? 520 : 130,
      now
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      name === "telegraph" ? 54 : name === "slash" ? 1200 : name === "success" ? 880 : 72,
      now + (name === "telegraph" ? 0.22 : 0.14)
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(name === "telegraph" ? 0.08 : 0.13, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (name === "success" ? 0.34 : name === "telegraph" ? 0.24 : 0.18)
    );
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.38);
  };

  return {
    unlock: ensureContext,
    handleSnapshot(snapshot: CombatSnapshot, previous: CombatSnapshot) {
      if (
        snapshot.mode === "combat" &&
        snapshot.enemy.state === "telegraph" &&
        previous.enemy.state !== "telegraph"
      ) {
        playTone("telegraph");
      }
      if (snapshot.player.state === "strike" && previous.player.state !== "strike") {
        playTone("slash");
      }
      if (snapshot.mode === "resolved" && previous.mode !== "resolved") {
        playTone(snapshot.result === "success" ? "success" : "fail");
      }
    }
  };
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

export const createDuelExperience = ({ mount, onStateChange }: ExperienceOptions) => {
  const controller = new CombatController();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = createStageScene(mount, reducedMotion);
  const size = new Vector2();

  const pressedKeys = new Set<string>();
  let attackQueued = false;
  let viewportMode: ViewportMode = "desktop";
  let lastSnapshot = controller.getSnapshot(viewportMode);
  let lastNotifiedKey = "";
  let accumulator = 0;
  let lastFrameTime = performance.now();
  let animationFrameId = 0;
  let touchStick: PointerStickState | null = null;
  const sfx = createSfxController();

  const emitState = (force = false) => {
    const snapshot = controller.getSnapshot(viewportMode);
    const previousSnapshot = lastSnapshot;
    lastSnapshot = snapshot;
    scene.render(snapshot, performance.now());
    sfx.handleSnapshot(snapshot, previousSnapshot);

    const notifyKey = [
      snapshot.mode,
      snapshot.result,
      snapshot.title,
      snapshot.subtitle,
      snapshot.hint,
      snapshot.enemy.telegraphType,
      snapshot.enemy.state
    ].join("|");

    if (force || notifyKey !== lastNotifiedKey) {
      lastNotifiedKey = notifyKey;
      onStateChange(snapshot);
    }
  };

  const resize = () => {
    const bounds = mount.getBoundingClientRect();
    size.set(Math.max(bounds.width, 1), Math.max(bounds.height, 1));
    viewportMode =
      size.x < 720 || size.x / size.y < 0.95
        ? "portrait"
        : size.x < 1080 || size.x / size.y < 1.35
          ? "tablet"
          : "desktop";
    scene.resize(size, viewportMode);
    emitState(true);
  };

  const readMovement = (): CombatInput => {
    let moveX = 0;
    let moveZ = 0;

    if (pressedKeys.has("ArrowLeft") || pressedKeys.has("KeyA")) moveX -= 1;
    if (pressedKeys.has("ArrowRight") || pressedKeys.has("KeyD")) moveX += 1;
    if (pressedKeys.has("ArrowUp") || pressedKeys.has("KeyW")) moveZ -= 1;
    if (pressedKeys.has("ArrowDown") || pressedKeys.has("KeyS")) moveZ += 1;

    if (touchStick) {
      const dx = touchStick.currentX - touchStick.centerX;
      const dy = touchStick.currentY - touchStick.centerY;
      moveX += Math.max(-1, Math.min(1, dx / 56));
      moveZ += Math.max(-1, Math.min(1, dy / 56));
    }

    const input = {
      moveX: Math.max(-1, Math.min(1, moveX)),
      moveZ: Math.max(-1, Math.min(1, moveZ)),
      attackPressed: attackQueued
    };
    attackQueued = false;
    return input;
  };

  const stepSimulation = (deltaSeconds: number) => {
    accumulator += deltaSeconds;

    while (accumulator >= FIXED_STEP) {
      controller.step(FIXED_STEP, readMovement());
      accumulator -= FIXED_STEP;
    }

    emitState();
  };

  const frame = (now: number) => {
    const delta = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    stepSimulation(delta);
    animationFrameId = window.requestAnimationFrame(frame);
  };

  const queueAttack = () => {
    sfx.unlock();
    attackQueued = true;
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await mount.requestFullscreen();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    sfx.unlock();

    if (event.code === "Space") {
      event.preventDefault();
      queueAttack();
      return;
    }

    if (event.code === "KeyF") {
      event.preventDefault();
      void toggleFullscreen();
      return;
    }

    pressedKeys.add(event.code);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    pressedKeys.delete(event.code);
  };

  const onPointerDown = (event: PointerEvent) => {
    sfx.unlock();

    if (event.pointerType === "touch") {
      const bounds = mount.getBoundingClientRect();
      const localX = event.clientX - bounds.left;

      if (localX < bounds.width * 0.52) {
        touchStick = {
          pointerId: event.pointerId,
          centerX: event.clientX,
          centerY: event.clientY,
          currentX: event.clientX,
          currentY: event.clientY
        };
      } else {
        queueAttack();
      }

      return;
    }

    queueAttack();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!touchStick || event.pointerId !== touchStick.pointerId) {
      return;
    }

    touchStick.currentX = event.clientX;
    touchStick.currentY = event.clientY;
  };

  const clearTouchStick = (pointerId: number) => {
    if (touchStick && touchStick.pointerId === pointerId) {
      touchStick = null;
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    clearTouchStick(event.pointerId);
  };

  const onPointerCancel = (event: PointerEvent) => {
    clearTouchStick(event.pointerId);
  };

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  mount.addEventListener("pointerdown", onPointerDown);
  mount.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  document.addEventListener("fullscreenchange", resize);

  window.render_game_to_text = () => renderCombatSnapshotToText(lastSnapshot);
  window.advanceTime = (ms: number) => {
    const frames = Math.max(1, Math.round(ms / (FIXED_STEP * 1000)));
    for (let index = 0; index < frames; index += 1) {
      controller.step(FIXED_STEP, readMovement());
    }
    accumulator = 0;
    lastFrameTime = performance.now();
    emitState(true);
  };

  emitState(true);
  animationFrameId = window.requestAnimationFrame(frame);

  return {
    getSnapshot: () => lastSnapshot,
    destroy: () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("fullscreenchange", resize);
      delete window.render_game_to_text;
      delete window.advanceTime;
      scene.dispose();
    }
  };
};
