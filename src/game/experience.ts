import { Vector2 } from "three";
import { CombatController, renderCombatSnapshotToText } from "./duel";
import { createStageScene } from "./scene";
import type { CombatInput, CombatSnapshot, TelegraphType, ViewportMode } from "./types";

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

type TelegraphCue = Exclude<TelegraphType, "none">;

const createSfxController = () => {
  let context: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let unlocked = false;
  let masterGain: GainNode | null = null;
  let ambientGain: GainNode | null = null;
  let windGain: GainNode | null = null;
  let dangerGain: GainNode | null = null;
  let windSource: AudioBufferSourceNode | null = null;
  let windFilter: BiquadFilterNode | null = null;
  let droneA: OscillatorNode | null = null;
  let droneB: OscillatorNode | null = null;
  let droneBeat: OscillatorNode | null = null;
  let playerStepAt = 0;
  let enemyStepAt = 0;
  let telegraphPulseAt = 0;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const createNoiseBuffer = (audio: AudioContext) => {
    const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      const drift = Math.sin(index / 180) * 0.18 + Math.sin(index / 47) * 0.08;
      data[index] = clamp(white * 0.68 + drift, -1, 1);
    }

    return buffer;
  };

  const createEnvelope = (
    audio: AudioContext,
    peak: number,
    attack: number,
    release: number,
    destination: AudioNode
  ) => {
    const gain = audio.createGain();
    const now = audio.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
    gain.connect(destination);
    return gain;
  };

  const playOscBurst = (
    audio: AudioContext,
    destination: AudioNode,
    {
      type,
      start,
      end,
      attack,
      release,
      peak,
      detune = 0
    }: {
      type: OscillatorType;
      start: number;
      end: number;
      attack: number;
      release: number;
      peak: number;
      detune?: number;
    }
  ) => {
    const osc = audio.createOscillator();
    const envelope = createEnvelope(audio, peak, attack, release, destination);
    const total = attack + release;

    osc.type = type;
    osc.frequency.setValueAtTime(start, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), audio.currentTime + total);
    osc.detune.setValueAtTime(detune, audio.currentTime);
    osc.connect(envelope);
    osc.start(audio.currentTime);
    osc.stop(audio.currentTime + total + 0.02);
  };

  const playNoiseBurst = (
    audio: AudioContext,
    destination: AudioNode,
    {
      peak,
      attack,
      release,
      frequency,
      q,
      playbackRate = 1,
      type = "bandpass"
    }: {
      peak: number;
      attack: number;
      release: number;
      frequency: number;
      q: number;
      playbackRate?: number;
      type?: BiquadFilterType;
    }
  ) => {
    noiseBuffer ??= createNoiseBuffer(audio);

    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const envelope = createEnvelope(audio, peak, attack, release, destination);
    const total = attack + release;

    filter.type = type;
    filter.frequency.setValueAtTime(frequency, audio.currentTime);
    filter.Q.setValueAtTime(q, audio.currentTime);
    source.buffer = noiseBuffer;
    source.loop = true;
    source.playbackRate.setValueAtTime(playbackRate, audio.currentTime);
    source.connect(filter).connect(envelope);
    source.start(audio.currentTime);
    source.stop(audio.currentTime + total + 0.03);
  };

  const setMixForSnapshot = (snapshot: CombatSnapshot) => {
    if (!context || !masterGain || !ambientGain || !windGain || !dangerGain || !windFilter) {
      return;
    }

    const now = context.currentTime;
    const inCombat = snapshot.mode === "combat";
    const inTelegraph = snapshot.enemy.state === "telegraph";
    const resolved = snapshot.mode === "resolved";

    masterGain.gain.setTargetAtTime(inCombat ? 0.48 : resolved ? 0.42 : 0.34, now, 0.18);
    ambientGain.gain.setTargetAtTime(inCombat ? 0.06 : 0.042, now, 0.28);
    windGain.gain.setTargetAtTime(inTelegraph ? 0.045 : 0.028, now, 0.36);
    dangerGain.gain.setTargetAtTime(
      inTelegraph ? 0.06 + snapshot.enemy.telegraphProgress * 0.045 : snapshot.enemy.vulnerable ? 0.022 : 0.01,
      now,
      0.14
    );
    windFilter.frequency.setTargetAtTime(inTelegraph ? 820 : 560, now, 0.2);
  };

  const playPlayerStep = (panAmount: number) => {
    if (!context || !masterGain) return;
    const audio = context;
    const panner = audio.createStereoPanner();
    panner.pan.setValueAtTime(clamp(panAmount, -0.55, 0.55), audio.currentTime);
    panner.connect(masterGain);

    playOscBurst(audio, panner, {
      type: "triangle",
      start: 142,
      end: 74,
      attack: 0.01,
      release: 0.09,
      peak: 0.024
    });
    playNoiseBurst(audio, panner, {
      peak: 0.012,
      attack: 0.004,
      release: 0.06,
      frequency: 860,
      q: 0.7,
      playbackRate: 1.2,
      type: "highpass"
    });
  };

  const playEnemyStep = (panAmount: number, urgent = false) => {
    if (!context || !masterGain) return;
    const audio = context;
    const panner = audio.createStereoPanner();
    panner.pan.setValueAtTime(clamp(panAmount, -0.7, 0.7), audio.currentTime);
    panner.connect(masterGain);

    playOscBurst(audio, panner, {
      type: "sine",
      start: urgent ? 110 : 92,
      end: 52,
      attack: 0.008,
      release: urgent ? 0.12 : 0.15,
      peak: urgent ? 0.05 : 0.032
    });
    playNoiseBurst(audio, panner, {
      peak: urgent ? 0.02 : 0.013,
      attack: 0.005,
      release: 0.08,
      frequency: urgent ? 520 : 380,
      q: 0.9,
      playbackRate: urgent ? 0.7 : 0.58
    });
  };

  const playTelegraphCue = (cue: TelegraphCue) => {
    if (!context || !masterGain) return;
    const audio = context;

    if (cue === "dash") {
      playNoiseBurst(audio, masterGain, {
        peak: 0.032,
        attack: 0.01,
        release: 0.22,
        frequency: 1400,
        q: 2.4,
        playbackRate: 1.35
      });
      playOscBurst(audio, masterGain, {
        type: "triangle",
        start: 210,
        end: 620,
        attack: 0.01,
        release: 0.18,
        peak: 0.038
      });
      return;
    }

    if (cue === "sweep") {
      playNoiseBurst(audio, masterGain, {
        peak: 0.028,
        attack: 0.008,
        release: 0.28,
        frequency: 980,
        q: 4,
        playbackRate: 0.88
      });
      playOscBurst(audio, masterGain, {
        type: "sawtooth",
        start: 340,
        end: 170,
        attack: 0.012,
        release: 0.24,
        peak: 0.028,
        detune: -6
      });
      return;
    }

    playOscBurst(audio, masterGain, {
      type: "triangle",
      start: 120,
      end: 46,
      attack: 0.01,
      release: 0.34,
      peak: 0.06
    });
    playNoiseBurst(audio, masterGain, {
      peak: 0.022,
      attack: 0.006,
      release: 0.18,
      frequency: 300,
      q: 1.2,
      playbackRate: 0.55
    });
  };

  const playTelegraphPulse = (cue: TelegraphCue, progress: number) => {
    if (!context || !dangerGain) return;
    const audio = context;
    const base = cue === "slam" ? 88 : cue === "sweep" ? 164 : 220;
    playOscBurst(audio, dangerGain, {
      type: cue === "sweep" ? "square" : "sine",
      start: base * (1 + progress * 0.04),
      end: base * 0.7,
      attack: 0.004,
      release: 0.09,
      peak: 0.022 + progress * 0.018
    });
  };

  const playVulnerableCue = () => {
    if (!context || !masterGain) return;
    const audio = context;
    const destination = masterGain;
    [0, 0.06, 0.12].forEach((offset, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const target = [460, 690, 920][index];
      gain.gain.setValueAtTime(0.0001, audio.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.018, audio.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + offset + 0.16);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(target * 0.92, audio.currentTime + offset);
      osc.frequency.exponentialRampToValueAtTime(target, audio.currentTime + offset + 0.12);
      osc.connect(gain).connect(destination);
      osc.start(audio.currentTime + offset);
      osc.stop(audio.currentTime + offset + 0.18);
    });
  };

  const playSlashCue = (landed: boolean) => {
    if (!context || !masterGain) return;
    const audio = context;
    playNoiseBurst(audio, masterGain, {
      peak: landed ? 0.05 : 0.03,
      attack: 0.003,
      release: 0.12,
      frequency: landed ? 1800 : 1450,
      q: 1.8,
      playbackRate: landed ? 1.5 : 1.3,
      type: "highpass"
    });
    playOscBurst(audio, masterGain, {
      type: "sawtooth",
      start: landed ? 420 : 340,
      end: landed ? 1080 : 840,
      attack: 0.004,
      release: 0.09,
      peak: landed ? 0.05 : 0.034
    });
    if (landed) {
      playOscBurst(audio, masterGain, {
        type: "triangle",
        start: 160,
        end: 72,
        attack: 0.005,
        release: 0.16,
        peak: 0.04
      });
    }
  };

  const playResolvedCue = (result: CombatSnapshot["result"], runComplete: boolean) => {
    if (!context || !masterGain) return;
    const audio = context;
    const destination = masterGain;

    if (result === "success") {
      const notes = runComplete ? [392, 523.25, 659.25] : [329.63, 440];
      notes.forEach((note, index) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * 0.09;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(runComplete ? 0.05 : 0.036, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + (runComplete ? 0.34 : 0.24));
        osc.type = "triangle";
        osc.frequency.setValueAtTime(note, start);
        osc.frequency.exponentialRampToValueAtTime(note * 1.015, start + 0.18);
        osc.connect(gain).connect(destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
      return;
    }

    playOscBurst(audio, masterGain, {
      type: "sawtooth",
      start: 180,
      end: 58,
      attack: 0.008,
      release: 0.34,
      peak: 0.06
    });
    playNoiseBurst(audio, masterGain, {
      peak: 0.03,
      attack: 0.004,
      release: 0.2,
      frequency: 240,
      q: 1.2,
      playbackRate: 0.58
    });
  };

  const buildAmbientBed = (audio: AudioContext) => {
    if (masterGain) return;

    noiseBuffer = createNoiseBuffer(audio);

    masterGain = audio.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(audio.destination);

    ambientGain = audio.createGain();
    ambientGain.gain.value = 0.0001;
    ambientGain.connect(masterGain);

    windGain = audio.createGain();
    windGain.gain.value = 0.0001;
    windGain.connect(ambientGain);

    dangerGain = audio.createGain();
    dangerGain.gain.value = 0.0001;
    dangerGain.connect(masterGain);

    windSource = audio.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    windSource.playbackRate.value = 0.22;

    windFilter = audio.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 560;
    windFilter.Q.value = 0.35;

    const windFloor = audio.createBiquadFilter();
    windFloor.type = "highpass";
    windFloor.frequency.value = 90;

    windSource.connect(windFilter).connect(windFloor).connect(windGain);
    windSource.start();

    droneA = audio.createOscillator();
    droneA.type = "triangle";
    droneA.frequency.value = 55;

    droneB = audio.createOscillator();
    droneB.type = "sine";
    droneB.frequency.value = 82.5;

    const droneGain = audio.createGain();
    droneGain.gain.value = 0.018;
    droneGain.connect(ambientGain);

    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneA.start();
    droneB.start();

    droneBeat = audio.createOscillator();
    droneBeat.type = "sine";
    droneBeat.frequency.value = 0.18;
    const droneBeatGain = audio.createGain();
    droneBeatGain.gain.value = 18;
    droneBeat.connect(droneBeatGain);
    droneBeatGain.connect(droneA.frequency);
    droneBeat.start();
  };

  const ensureContext = () => {
    if (!context) {
      context = new AudioContext();
    }
    if (context.state === "suspended") {
      void context.resume();
    }
    buildAmbientBed(context);
    unlocked = true;
    return context;
  };

  return {
    unlock: ensureContext,
    handleSnapshot(snapshot: CombatSnapshot, previous: CombatSnapshot) {
      if (!unlocked) return;
      const audio = ensureContext();
      const now = audio.currentTime;

      setMixForSnapshot(snapshot);

      const playerMoving = snapshot.mode === "combat" && snapshot.player.state === "move";
      if (playerMoving && now >= playerStepAt) {
        playPlayerStep(snapshot.player.x / Math.max(snapshot.arenaRadius, 1));
        playerStepAt = now + 0.22;
      }

      const enemyPressuring =
        snapshot.mode === "combat" &&
        (snapshot.enemy.state === "move" ||
          snapshot.enemy.state === "telegraph" ||
          snapshot.enemy.state === "attack");
      if (enemyPressuring && now >= enemyStepAt) {
        playEnemyStep(
          snapshot.enemy.x / Math.max(snapshot.arenaRadius, 1),
          snapshot.enemy.state === "telegraph" || snapshot.enemy.state === "attack"
        );
        enemyStepAt =
          now +
          (snapshot.enemy.state === "attack"
            ? 0.18
            : snapshot.enemy.state === "telegraph"
              ? 0.23
              : 0.31);
      }

      if (
        snapshot.mode === "combat" &&
        snapshot.enemy.state === "telegraph" &&
        previous.enemy.state !== "telegraph"
      ) {
        playTelegraphCue(snapshot.enemy.telegraphType as TelegraphCue);
      }

      if (
        snapshot.enemy.state === "telegraph" &&
        snapshot.enemy.telegraphType !== "none" &&
        now >= telegraphPulseAt
      ) {
        playTelegraphPulse(snapshot.enemy.telegraphType as TelegraphCue, snapshot.enemy.telegraphProgress);
        telegraphPulseAt =
          now + clamp(0.28 - snapshot.enemy.telegraphProgress * 0.16, 0.08, 0.28);
      } else if (snapshot.enemy.state !== "telegraph") {
        telegraphPulseAt = now;
      }

      if (snapshot.enemy.state === "vulnerable" && previous.enemy.state !== "vulnerable") {
        playVulnerableCue();
      }

      if (snapshot.player.state === "strike" && previous.player.state !== "strike") {
        const landed = snapshot.result === "success" || previous.enemy.state === "vulnerable";
        playSlashCue(landed);
      }

      if (snapshot.mode === "resolved" && previous.mode !== "resolved") {
        playResolvedCue(snapshot.result, snapshot.runComplete);
      }
    },
    destroy() {
      if (!context) return;

      const audio = context;
      if (masterGain) {
        masterGain.gain.cancelScheduledValues(audio.currentTime);
        masterGain.gain.setTargetAtTime(0.0001, audio.currentTime, 0.08);
      }
      windSource?.stop(audio.currentTime + 0.12);
      droneA?.stop(audio.currentTime + 0.12);
      droneB?.stop(audio.currentTime + 0.12);
      droneBeat?.stop(audio.currentTime + 0.12);
      void audio.close();
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
      sfx.destroy();
      scene.dispose();
    }
  };
};
