import {
  AmbientLight,
  BoxGeometry,
  Color,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  WebGLRenderer
} from "three";
import type { DuelOutcome, DuelPhase } from "./types";

interface SceneState {
  phase: DuelPhase;
  outcome: DuelOutcome;
  phaseElapsed: number;
}

interface FighterRig {
  root: Group;
  blade: Mesh<BoxGeometry, MeshStandardMaterial>;
  aura: Mesh<RingGeometry, MeshBasicMaterial>;
}

export interface StageScene {
  render(state: SceneState, now: number): void;
  resize(size: Vector2): void;
  dispose(): void;
}

export const createStageScene = (
  mount: HTMLElement,
  reducedMotion: boolean
): StageScene => {
  const scene = new Scene();
  scene.background = new Color("#0c0b0b");

  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 4.6, 12.8);
  camera.lookAt(0, 2.4, 0);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = "stage-shell__webgl";
  mount.appendChild(renderer.domElement);

  const ambient = new AmbientLight("#f3ebe0", 1.15);
  scene.add(ambient);

  const hemi = new HemisphereLight("#f7ecd8", "#0f0d0d", 1.5);
  hemi.position.set(0, 10, 0);
  scene.add(hemi);

  const moon = new Mesh(
    new SphereGeometry(1.35, 24, 24),
    new MeshBasicMaterial({ color: "#f0e5d3" })
  );
  moon.position.set(0, 7.6, -7.4);
  scene.add(moon);

  const moonHalo = new Mesh(
    new RingGeometry(1.55, 2.35, 48),
    new MeshBasicMaterial({
      color: "#f7efe5",
      transparent: true,
      opacity: 0.08
    })
  );
  moonHalo.position.copy(moon.position);
  scene.add(moonHalo);

  const floor = new Mesh(
    new PlaneGeometry(26, 12),
    new MeshStandardMaterial({
      color: "#151313",
      roughness: 1,
      metalness: 0
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const path = new Mesh(
    new PlaneGeometry(9, 5),
    new MeshBasicMaterial({
      color: "#3a3028",
      transparent: true,
      opacity: 0.24
    })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, 0.5);
  scene.add(path);

  const mistBands = createMistBands();
  scene.add(mistBands);

  scene.add(createTorii(-6.8));
  scene.add(createTorii(6.8, true));

  const player = createFighter("#151314", "#e4dfd8", false);
  const enemy = createFighter("#171515", "#892621", true);
  player.root.position.set(-2.2, 0, 0.4);
  enemy.root.position.set(2.2, 0, 0.2);
  scene.add(player.root, enemy.root);

  const dangerRing = new Mesh(
    new TorusGeometry(1.18, 0.04, 18, 64),
    new MeshBasicMaterial({
      color: "#d34d43",
      transparent: true,
      opacity: 0
    })
  );
  dangerRing.rotation.x = Math.PI / 2;
  dangerRing.position.set(2.25, 1.52, 0.16);
  scene.add(dangerRing);

  const slash = new Mesh(
    new BoxGeometry(3.8, 0.12, 0.24),
    new MeshBasicMaterial({
      color: "#fff4e5",
      transparent: true,
      opacity: 0
    })
  );
  slash.position.set(0.1, 1.8, 0.6);
  slash.rotation.z = -0.55;
  scene.add(slash);

  const screenGlow = new Mesh(
    new PlaneGeometry(18, 11),
    new MeshBasicMaterial({
      color: "#d34d43",
      transparent: true,
      opacity: 0
    })
  );
  screenGlow.position.set(0, 4, -9);
  scene.add(screenGlow);

  const size = new Vector2();

  return {
    render(state, now) {
      const idleWave = Math.sin(now * 0.0012) * (reducedMotion ? 0.02 : 0.08);
      const phasePulse = Math.sin(state.phaseElapsed * 18);
      const threat =
        state.phase === "omen"
          ? 0.45 + state.phaseElapsed * 0.45
          : state.phase === "strike-window"
            ? 1
            : state.phase === "resolved" && state.outcome === "fail"
              ? 0.65
              : 0;

      player.root.position.y = idleWave * 0.35;
      enemy.root.position.y = -idleWave * 0.18;
      player.root.rotation.z = 0;
      enemy.root.rotation.z = 0;
      player.root.position.x = -2.2;
      enemy.root.position.x = 2.2;

      player.blade.material.emissive.set("#3f3a34");
      player.blade.material.emissiveIntensity = 0.18;
      enemy.blade.material.emissive.set("#d34d43");
      enemy.blade.material.emissiveIntensity = MathUtils.lerp(
        enemy.blade.material.emissiveIntensity,
        threat * 1.4,
        0.15
      );

      enemy.aura.material.opacity = MathUtils.lerp(
        enemy.aura.material.opacity,
        threat * 0.42,
        0.12
      );
      enemy.aura.scale.setScalar(1 + threat * 0.16);

      dangerRing.material.opacity = threat * 0.72;
      dangerRing.scale.setScalar(1 + threat * 0.28 + Math.max(0, phasePulse) * 0.02);

      slash.material.opacity = 0;
      screenGlow.material.opacity = 0;

      if (state.phase === "omen") {
        enemy.root.position.x = 2.2 - state.phaseElapsed * 0.24;
        enemy.root.rotation.z = -0.08;
      }

      if (state.phase === "strike-window") {
        enemy.root.position.x = 1.9;
        enemy.root.rotation.z = -0.15;
        player.root.rotation.z = 0.06;
      }

      if (state.phase === "resolved" && state.outcome === "success") {
        const burst = MathUtils.clamp(state.phaseElapsed / 0.22, 0, 1);
        player.root.position.x = MathUtils.lerp(-2.2, -0.4, burst);
        player.root.rotation.z = 0.16;
        enemy.root.position.x = MathUtils.lerp(2.2, 3.2, burst);
        enemy.root.rotation.z = -0.42;
        enemy.root.position.y = -burst * 0.3;
        slash.material.opacity = 0.82 - burst * 0.42;
      }

      if (state.phase === "resolved" && state.outcome === "fail") {
        const burst = MathUtils.clamp(state.phaseElapsed / 0.18, 0, 1);
        enemy.root.position.x = MathUtils.lerp(2.2, 0.8, burst);
        enemy.root.rotation.z = -0.08;
        player.root.position.x = MathUtils.lerp(-2.2, -2.8, burst);
        player.root.rotation.z = -0.22;
        screenGlow.material.opacity = 0.16 - burst * 0.08;
      }

      if (state.phase === "reset") {
        const settle = MathUtils.clamp(state.phaseElapsed / 0.5, 0, 1);
        player.root.position.x = MathUtils.lerp(player.root.position.x, -2.2, settle * 0.1);
        enemy.root.position.x = MathUtils.lerp(enemy.root.position.x, 2.2, settle * 0.1);
      }

      camera.position.x = reducedMotion ? 0 : Math.sin(now * 0.0004) * 0.18;
      camera.position.y = 4.6 + (reducedMotion ? 0 : Math.cos(now * 0.0006) * 0.08);
      camera.lookAt(0, 2.35, 0.2);

      renderer.render(scene, camera);
    },

    resize(nextSize) {
      size.copy(nextSize);
      camera.aspect = size.x / size.y;
      camera.updateProjectionMatrix();
      renderer.setSize(size.x, size.y, false);
    },

    dispose() {
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    }
  };
};

const createTorii = (x: number, flip = false) => {
  const group = new Group();
  const material = new MeshStandardMaterial({
    color: "#8f241f",
    roughness: 0.95,
    metalness: 0.02
  });

  const cross = new Mesh(new BoxGeometry(2.6, 0.16, 0.2), material);
  cross.position.y = 2.9;
  group.add(cross);

  const crossTop = new Mesh(new BoxGeometry(2, 0.12, 0.18), material);
  crossTop.position.y = 2.62;
  group.add(crossTop);

  const postGeometry = new BoxGeometry(0.18, 2.5, 0.18);
  const leftPost = new Mesh(postGeometry, material);
  const rightPost = new Mesh(postGeometry, material);
  leftPost.position.set(-0.78, 1.45, 0);
  rightPost.position.set(0.78, 1.45, 0);
  group.add(leftPost, rightPost);

  group.position.set(x, 0, -3.8);
  group.scale.setScalar(flip ? 0.9 : 1.05);
  return group;
};

const createMistBands = () => {
  const group = new Group();
  const material = new MeshBasicMaterial({
    color: "#b4aca3",
    transparent: true,
    opacity: 0.08
  });

  const bandA = new Mesh(new PlaneGeometry(15, 2.4), material);
  bandA.position.set(-1.6, 1.3, -2.4);
  group.add(bandA);

  const bandB = new Mesh(
    new PlaneGeometry(13, 2.2),
    material.clone()
  );
  bandB.material.opacity = 0.05;
  bandB.position.set(1.8, 2.6, -4.8);
  group.add(bandB);

  return group;
};

const createFighter = (bodyColor: string, bladeColor: string, enemy: boolean): FighterRig => {
  const root = new Group();

  const bodyMaterial = new MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.96,
    metalness: 0.02
  });

  const bladeMaterial = new MeshStandardMaterial({
    color: bladeColor,
    roughness: 0.34,
    metalness: 0.18,
    emissive: "#000000",
    emissiveIntensity: 0
  });

  const torso = new Mesh(new BoxGeometry(0.66, 1.7, 0.36), bodyMaterial);
  torso.position.y = 1.54;
  root.add(torso);

  const head = new Mesh(
    new SphereGeometry(0.28, 16, 16),
    bodyMaterial.clone()
  );
  head.position.set(0, 2.58, 0);
  root.add(head);

  const leftLeg = new Mesh(new BoxGeometry(0.16, 1.2, 0.16), bodyMaterial);
  const rightLeg = new Mesh(new BoxGeometry(0.16, 1.2, 0.16), bodyMaterial);
  leftLeg.position.set(-0.15, 0.58, 0);
  rightLeg.position.set(0.15, 0.58, 0);
  root.add(leftLeg, rightLeg);

  const shoulder = new Mesh(new BoxGeometry(0.9, 0.18, 0.18), bodyMaterial);
  shoulder.position.set(0, 2.02, 0);
  root.add(shoulder);

  const forearm = new Mesh(new BoxGeometry(0.18, 1.1, 0.18), bodyMaterial);
  forearm.position.set(enemy ? -0.58 : 0.58, 1.58, 0);
  forearm.rotation.z = enemy ? 0.82 : -0.82;
  root.add(forearm);

  const blade = new Mesh(new BoxGeometry(1.72, 0.08, 0.08), bladeMaterial);
  blade.position.set(enemy ? -1.18 : 1.18, 2.02, 0.04);
  blade.rotation.z = enemy ? 0.24 : -0.24;
  root.add(blade);

  const aura = new Mesh(
    new RingGeometry(0.52, 0.76, 32),
    new MeshBasicMaterial({
      color: "#d34d43",
      transparent: true,
      opacity: 0
    })
  );
  aura.position.set(enemy ? -1.18 : 1.18, 2.02, 0.02);
  root.add(aura);

  if (enemy) {
    root.rotation.y = Math.PI;
  }

  return {
    root,
    blade,
    aura
  };
};
