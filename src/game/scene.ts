import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
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
import type { CombatSnapshot, TelegraphType, ViewportMode } from "./types";

interface FighterRig {
  root: Group;
  torso: Mesh<BoxGeometry, MeshStandardMaterial>;
  head: Mesh<SphereGeometry, MeshStandardMaterial>;
  blade: Mesh<BoxGeometry, MeshStandardMaterial>;
  trail: Mesh<BoxGeometry, MeshBasicMaterial>;
  aura: Mesh<TorusGeometry, MeshBasicMaterial>;
  marker: Mesh<RingGeometry, MeshBasicMaterial>;
  shadow: Mesh<CircleGeometry, MeshBasicMaterial>;
}

export interface StageScene {
  render(snapshot: CombatSnapshot, now: number): void;
  resize(size: Vector2, viewportMode: ViewportMode): void;
  dispose(): void;
}

const createFighter = (
  bodyColor: string,
  bladeColor: string,
  markerColor: string,
  flipped = false
): FighterRig => {
  const root = new Group();

  const bodyMaterial = new MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.92,
    metalness: 0.02
  });

  const bladeMaterial = new MeshStandardMaterial({
    color: bladeColor,
    roughness: 0.28,
    metalness: 0.18,
    emissive: bladeColor,
    emissiveIntensity: 0.1
  });

  const torso = new Mesh(new BoxGeometry(0.66, 1.55, 0.42), bodyMaterial);
  torso.position.y = 1.45;
  root.add(torso);

  const head = new Mesh(new SphereGeometry(0.28, 20, 20), bodyMaterial.clone());
  head.position.y = 2.52;
  root.add(head);

  const hip = new Mesh(new BoxGeometry(0.72, 0.2, 0.34), bodyMaterial);
  hip.position.y = 0.64;
  root.add(hip);

  const leftLeg = new Mesh(new BoxGeometry(0.16, 1.12, 0.16), bodyMaterial);
  const rightLeg = new Mesh(new BoxGeometry(0.16, 1.12, 0.16), bodyMaterial);
  leftLeg.position.set(-0.18, 0.2, 0.06);
  rightLeg.position.set(0.18, 0.2, -0.06);
  root.add(leftLeg, rightLeg);

  const shoulder = new Mesh(new BoxGeometry(0.92, 0.18, 0.22), bodyMaterial);
  shoulder.position.y = 1.94;
  root.add(shoulder);

  const armGeometry = new BoxGeometry(0.16, 1.12, 0.16);
  const arm = new Mesh(armGeometry, bodyMaterial);
  arm.position.set(flipped ? -0.42 : 0.42, 1.6, 0.08);
  arm.rotation.z = flipped ? 0.52 : -0.52;
  root.add(arm);

  const blade = new Mesh(new BoxGeometry(1.62, 0.08, 0.1), bladeMaterial);
  blade.position.set(flipped ? -0.96 : 0.96, 1.98, 0.18);
  blade.rotation.z = flipped ? 0.08 : -0.08;
  root.add(blade);

  const trail = new Mesh(
    new BoxGeometry(1.95, 0.26, 0.36),
    new MeshBasicMaterial({
      color: bladeColor,
      transparent: true,
      opacity: 0
    })
  );
  trail.position.set(flipped ? -1.24 : 1.24, 1.98, 0.16);
  trail.rotation.z = flipped ? -0.18 : 0.18;
  root.add(trail);

  const aura = new Mesh(
    new TorusGeometry(0.48, 0.06, 18, 48),
    new MeshBasicMaterial({
      color: markerColor,
      transparent: true,
      opacity: 0
    })
  );
  aura.position.set(0, 1.15, 0);
  aura.rotation.x = Math.PI / 2;
  root.add(aura);

  const marker = new Mesh(
    new RingGeometry(0.42, 0.5, 48),
    new MeshBasicMaterial({
      color: markerColor,
      transparent: true,
      opacity: 0.4
    })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.03;
  root.add(marker);

  const shadow = new Mesh(
    new CircleGeometry(0.72, 24),
    new MeshBasicMaterial({
      color: "#000000",
      transparent: true,
      opacity: 0.13
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  return {
    root,
    torso,
    head,
    blade,
    trail,
    aura,
    marker,
    shadow
  };
};

const createTorii = (x: number, z: number, scale: number) => {
  const group = new Group();
  const material = new MeshStandardMaterial({
    color: "#a53b34",
    roughness: 0.96,
    metalness: 0.02
  });

  const top = new Mesh(new BoxGeometry(3.2, 0.18, 0.24), material);
  top.position.y = 3.4;
  group.add(top);

  const sub = new Mesh(new BoxGeometry(2.5, 0.14, 0.22), material);
  sub.position.y = 3.1;
  group.add(sub);

  const left = new Mesh(new BoxGeometry(0.24, 3.1, 0.24), material);
  const right = left.clone();
  left.position.set(-0.98, 1.52, 0);
  right.position.set(0.98, 1.52, 0);
  group.add(left, right);

  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  return group;
};

const setTrailOpacity = (fighter: FighterRig, opacity: number, scale = 1) => {
  fighter.trail.material.opacity = opacity;
  fighter.trail.scale.set(scale, 1, 1);
};

export const createStageScene = (mount: HTMLElement, reducedMotion: boolean): StageScene => {
  const scene = new Scene();
  scene.background = new Color("#f4efe7");

  const camera = new PerspectiveCamera(42, 1, 0.1, 120);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = "stage-shell__webgl";
  mount.appendChild(renderer.domElement);

  scene.add(new AmbientLight("#f4ede1", 1.1));
  const hemi = new HemisphereLight("#faf6ef", "#c6b6a2", 1.1);
  hemi.position.set(0, 12, 0);
  scene.add(hemi);

  const dir = new DirectionalLight("#fff8f0", 1.35);
  dir.position.set(-5.4, 8.8, 7.2);
  scene.add(dir);

  const moon = new Mesh(
    new SphereGeometry(1.15, 24, 24),
    new MeshBasicMaterial({ color: "#d8d2c8" })
  );
  moon.position.set(-4.8, 8.1, -12.2);
  scene.add(moon);

  const moonHalo = new Mesh(
    new RingGeometry(1.45, 2.45, 48),
    new MeshBasicMaterial({
      color: "#d9d4ca",
      transparent: true,
      opacity: 0.18
    })
  );
  moonHalo.position.copy(moon.position);
  scene.add(moonHalo);

  const ground = new Mesh(
    new CircleGeometry(12, 96),
    new MeshStandardMaterial({
      color: "#d9d1c3",
      roughness: 1,
      metalness: 0
    })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const arenaRing = new Mesh(
    new RingGeometry(4.75, 5.05, 96),
    new MeshBasicMaterial({
      color: "#9e8e7c",
      transparent: true,
      opacity: 0.28
    })
  );
  arenaRing.rotation.x = -Math.PI / 2;
  arenaRing.position.y = 0.02;
  scene.add(arenaRing);

  const centerGlyph = new Mesh(
    new RingGeometry(1.2, 1.6, 64),
    new MeshBasicMaterial({
      color: "#b9aa95",
      transparent: true,
      opacity: 0.18
    })
  );
  centerGlyph.rotation.x = -Math.PI / 2;
  centerGlyph.position.y = 0.03;
  scene.add(centerGlyph);

  const pathStripe = new Mesh(
    new PlaneGeometry(2.1, 9.4),
    new MeshBasicMaterial({
      color: "#907f6d",
      transparent: true,
      opacity: 0.08
    })
  );
  pathStripe.rotation.x = -Math.PI / 2;
  pathStripe.position.set(0, 0.015, -0.25);
  scene.add(pathStripe);

  const mistNear = new Mesh(
    new PlaneGeometry(18, 3.5),
    new MeshBasicMaterial({
      color: "#d6cec2",
      transparent: true,
      opacity: 0.16
    })
  );
  mistNear.position.set(0, 1.2, -2.8);
  scene.add(mistNear);

  const mistFar = new Mesh(
    new PlaneGeometry(22, 4.5),
    new MeshBasicMaterial({
      color: "#c7beb1",
      transparent: true,
      opacity: 0.12
    })
  );
  mistFar.position.set(1.4, 2.8, -9.6);
  scene.add(mistFar);

  scene.add(createTorii(-8.6, -9.8, 1.18));
  scene.add(createTorii(8.1, -13.4, 0.92));
  scene.add(createTorii(-2.2, -16.2, 0.64));

  const player = createFighter("#26211d", "#f6ece0", "#3a332d", false);
  const enemy = createFighter("#181411", "#c94e44", "#c94e44", true);
  scene.add(player.root, enemy.root);

  const dashMarker = new Mesh(
    new BoxGeometry(0.56, 0.02, 6.6),
    new MeshBasicMaterial({
      color: "#c55249",
      transparent: true,
      opacity: 0
    })
  );
  dashMarker.position.y = 0.04;
  scene.add(dashMarker);

  const dashSafeA = new Mesh(
    new BoxGeometry(0.74, 0.02, 4.8),
    new MeshBasicMaterial({
      color: "#fff8ee",
      transparent: true,
      opacity: 0
    })
  );
  const dashSafeB = dashSafeA.clone();
  dashSafeA.position.y = 0.055;
  dashSafeB.position.y = 0.055;
  scene.add(dashSafeA, dashSafeB);

  const sweepMarker = new Mesh(
    new TorusGeometry(2.45, 0.14, 18, 72),
    new MeshBasicMaterial({
      color: "#c55249",
      transparent: true,
      opacity: 0
    })
  );
  sweepMarker.rotation.x = Math.PI / 2;
  sweepMarker.position.y = 0.05;
  scene.add(sweepMarker);

  const sweepSafe = new Mesh(
    new RingGeometry(2.72, 3.28, 72),
    new MeshBasicMaterial({
      color: "#fff8ee",
      transparent: true,
      opacity: 0
    })
  );
  sweepSafe.rotation.x = -Math.PI / 2;
  sweepSafe.position.y = 0.058;
  scene.add(sweepSafe);

  const slamOuter = new Mesh(
    new RingGeometry(1.4, 2.35, 72),
    new MeshBasicMaterial({
      color: "#c55249",
      transparent: true,
      opacity: 0
    })
  );
  slamOuter.rotation.x = -Math.PI / 2;
  slamOuter.position.y = 0.04;
  scene.add(slamOuter);

  const slamSafe = new Mesh(
    new RingGeometry(0.52, 1.06, 56),
    new MeshBasicMaterial({
      color: "#f4efe7",
      transparent: true,
      opacity: 0
    })
  );
  slamSafe.rotation.x = -Math.PI / 2;
  slamSafe.position.y = 0.045;
  scene.add(slamSafe);

  const impactFlash = new Mesh(
    new CylinderGeometry(0.1, 0.1, 0.04, 32),
    new MeshBasicMaterial({
      color: "#f4efe7",
      transparent: true,
      opacity: 0
    })
  );
  impactFlash.position.y = 0.06;
  scene.add(impactFlash);

  const inkCut = new Mesh(
    new PlaneGeometry(5.2, 0.42),
    new MeshBasicMaterial({
      color: "#171311",
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  scene.add(inkCut);

  const redCut = new Mesh(
    new PlaneGeometry(5.6, 0.3),
    new MeshBasicMaterial({
      color: "#c55249",
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  scene.add(redCut);

  const size = new Vector2();
  let currentViewportMode: ViewportMode = "desktop";

  const applyTelegraph = (
    type: TelegraphType,
    positionX: number,
    positionZ: number,
    facing: number,
    progress: number
  ) => {
    dashMarker.material.opacity = 0;
    dashSafeA.material.opacity = 0;
    dashSafeB.material.opacity = 0;
    sweepMarker.material.opacity = 0;
    sweepSafe.material.opacity = 0;
    slamOuter.material.opacity = 0;
    slamSafe.material.opacity = 0;

    if (type === "dash") {
      dashMarker.material.opacity = 0.22 + progress * 0.38;
      dashMarker.position.set(positionX, 0.04, positionZ);
      dashMarker.rotation.y = facing;
      dashMarker.scale.set(1, 1, 0.8 + progress * 0.45);

      const sideX = Math.cos(facing) * 1.42;
      const sideZ = -Math.sin(facing) * 1.42;
      dashSafeA.material.opacity = 0.1 + progress * 0.14;
      dashSafeB.material.opacity = dashSafeA.material.opacity;
      dashSafeA.position.set(positionX + sideX, 0.055, positionZ + sideZ);
      dashSafeB.position.set(positionX - sideX, 0.055, positionZ - sideZ);
      dashSafeA.rotation.y = facing;
      dashSafeB.rotation.y = facing;
    }

    if (type === "sweep") {
      sweepMarker.material.opacity = 0.16 + progress * 0.34;
      sweepMarker.position.set(positionX, 0.05, positionZ);
      sweepMarker.scale.setScalar(0.88 + progress * 0.24);
      sweepSafe.material.opacity = 0.08 + progress * 0.14;
      sweepSafe.position.set(positionX, 0.058, positionZ);
      sweepSafe.scale.setScalar(0.92 + progress * 0.12);
    }

    if (type === "slam") {
      slamOuter.material.opacity = 0.2 + progress * 0.34;
      slamOuter.position.set(positionX, 0.04, positionZ);
      slamOuter.scale.setScalar(0.9 + progress * 0.28);
      slamSafe.material.opacity = 0.2 + progress * 0.12;
      slamSafe.position.set(positionX, 0.045, positionZ);
    }
  };

  return {
    render(snapshot, now) {
      const time = now * 0.001;
      const enemyPulse = snapshot.enemy.telegraphProgress;
      const playerMove =
        snapshot.player.state === "move"
          ? Math.sin(time * 9.6) * 0.06
          : snapshot.player.state === "strike"
            ? 0.12
            : 0;
      const enemyMove =
        snapshot.enemy.state === "move"
          ? Math.sin(time * 7.4 + 0.8) * 0.05
          : snapshot.enemy.state === "telegraph"
            ? enemyPulse * 0.16
            : 0;

      player.root.position.set(snapshot.player.x, playerMove, snapshot.player.z);
      enemy.root.position.set(snapshot.enemy.x, enemyMove, snapshot.enemy.z);
      player.root.rotation.y = snapshot.player.facing;
      enemy.root.rotation.y = snapshot.enemy.facing;

      player.shadow.scale.setScalar(1 + Math.abs(playerMove) * 0.2);
      enemy.shadow.scale.setScalar(1 + enemyPulse * 0.22);

      player.marker.material.opacity = snapshot.mode === "title" ? 0.18 : 0.34;
      enemy.marker.material.opacity = 0.44;
      enemy.aura.material.opacity = snapshot.enemy.vulnerable ? 0.38 : enemyPulse * 0.28;
      enemy.aura.scale.setScalar(snapshot.enemy.vulnerable ? 1.14 : 1 + enemyPulse * 0.18);

      player.blade.material.emissiveIntensity =
        snapshot.player.state === "strike" ? 0.56 : 0.14;
      enemy.blade.material.emissiveIntensity =
        snapshot.enemy.state === "telegraph"
          ? 0.24 + enemyPulse * 0.95
          : snapshot.enemy.state === "attack"
            ? 0.82
            : snapshot.enemy.vulnerable
              ? 0.18
              : 0.14;

      const playerLean =
        snapshot.player.state === "strike"
          ? -0.24
          : snapshot.player.state === "move"
            ? Math.sin(time * 9.6) * 0.04
            : 0;
      const enemyLean =
        snapshot.enemy.state === "telegraph"
          ? -enemyPulse * 0.25
          : snapshot.enemy.state === "attack"
            ? -0.18
            : snapshot.enemy.state === "down"
              ? -0.68
              : 0;
      player.torso.rotation.z = playerLean;
      enemy.torso.rotation.z = enemyLean;
      enemy.head.rotation.x = snapshot.enemy.state === "down" ? 0.46 : 0;

      setTrailOpacity(
        player,
        snapshot.player.state === "strike" ? 0.48 : 0,
        snapshot.player.state === "strike" ? 1.1 : 0.8
      );
      setTrailOpacity(
        enemy,
        snapshot.enemy.state === "attack" ? 0.54 : snapshot.enemy.state === "telegraph" ? 0.22 : 0,
        snapshot.enemy.state === "attack" ? 1.28 : 0.9
      );

      applyTelegraph(
        snapshot.enemy.telegraphType,
        snapshot.enemy.x,
        snapshot.enemy.z,
        snapshot.enemy.facing,
        snapshot.enemy.telegraphProgress
      );

      impactFlash.material.opacity = 0;
      inkCut.material.opacity = 0;
      redCut.material.opacity = 0;
      if (snapshot.mode === "resolved") {
        impactFlash.material.color.set(snapshot.result === "success" ? "#fff8ee" : "#c55249");
        impactFlash.material.opacity = snapshot.result === "success" ? 0.22 : 0.32;
        impactFlash.position.set(
          MathUtils.lerp(snapshot.player.x, snapshot.enemy.x, 0.5),
          0.06,
          MathUtils.lerp(snapshot.player.z, snapshot.enemy.z, 0.5)
        );
        impactFlash.scale.setScalar(snapshot.result === "success" ? 12 : 14);

        const cut = snapshot.result === "success" ? inkCut : redCut;
        cut.material.opacity = snapshot.result === "success" ? 0.32 : 0.48;
        cut.position.set(
          MathUtils.lerp(snapshot.player.x, snapshot.enemy.x, 0.5),
          1.7,
          MathUtils.lerp(snapshot.player.z, snapshot.enemy.z, 0.5)
        );
        cut.rotation.set(-0.1, snapshot.player.facing - Math.PI / 2, snapshot.result === "success" ? -0.22 : 0.2);
      }

      const driftX = reducedMotion ? 0 : Math.sin(time * 0.48) * 0.06;
      const driftY = reducedMotion ? 0 : Math.cos(time * 0.37) * 0.04;
      camera.position.set(
        snapshot.camera.x + driftX,
        snapshot.camera.y + driftY,
        snapshot.camera.z
      );
      camera.lookAt(snapshot.camera.lookAtX, snapshot.camera.lookAtY, snapshot.camera.lookAtZ);

      mistNear.material.opacity = 0.12 + (snapshot.enemy.state === "telegraph" ? enemyPulse * 0.08 : 0);
      mistFar.material.opacity = 0.1 + (snapshot.mode === "title" ? 0.03 : 0);
      moonHalo.material.opacity = 0.16 + (snapshot.mode === "resolved" ? 0.03 : 0);

      renderer.render(scene, camera);
    },

    resize(nextSize, viewportMode) {
      size.copy(nextSize);
      currentViewportMode = viewportMode;
      camera.aspect = size.x / size.y;
      camera.fov = currentViewportMode === "portrait" ? 50 : currentViewportMode === "tablet" ? 46 : 42;
      camera.updateProjectionMatrix();
      renderer.setSize(size.x, size.y, false);
    },

    dispose() {
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    }
  };
};
