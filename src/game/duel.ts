import type {
  CameraSnapshot,
  CombatInput,
  CombatMode,
  CombatResult,
  CombatSnapshot,
  PlayerSnapshot,
  TelegraphType,
  ViewportMode
} from "./types";

const ARENA_RADIUS = 4.9;
const PLAYER_RADIUS = 0.42;
const ENEMY_RADIUS = 0.5;
const PLAYER_SPEED = 4.8;
const ENEMY_SPEED = 2.35;
const PLAYER_ATTACK_RANGE = 1.72;
const PLAYER_ATTACK_COOLDOWN = 0.48;
const PLAYER_STRIKE_TIME = 0.2;
const RESOLVED_INPUT_LOCK = 0.32;
const ROUND_ADVANCE_DELAY = 0.82;
const MAX_ROUNDS = 5;
const MAX_MISSES = 3;

const telegraphDurations: Record<Exclude<TelegraphType, "none">, number> = {
  dash: 0.92,
  sweep: 0.86,
  slam: 1
};

const telegraphOpenings: Record<Exclude<TelegraphType, "none">, number> = {
  dash: 0.62,
  sweep: 0.68,
  slam: 0.74
};

interface Vec2 {
  x: number;
  z: number;
}

interface FighterState {
  position: Vec2;
  facing: number;
  state: PlayerSnapshot["state"];
}

interface PlayerState extends FighterState {
  velocity: Vec2;
  attackCooldown: number;
  strikeTimer: number;
}

interface EnemyState extends FighterState {
  telegraphType: TelegraphType;
  telegraphTimer: number;
  vulnerableTimer: number;
  actionCooldown: number;
  orbitDirection: 1 | -1;
  attackIndex: number;
  attackForward: Vec2;
  attackAnchor: Vec2;
}

const attackOrder: Exclude<TelegraphType, "none">[] = ["dash", "sweep", "slam"];

interface RoundTuning {
  telegraphScale: number;
  openingScale: number;
  actionDelay: number;
  enemySpeedScale: number;
  attackOffset: number;
}

const roundTunings: RoundTuning[] = [
  { telegraphScale: 1.06, openingScale: 1.06, actionDelay: 1.12, enemySpeedScale: 0.95, attackOffset: 0 },
  { telegraphScale: 0.98, openingScale: 1, actionDelay: 0.96, enemySpeedScale: 1, attackOffset: 1 },
  { telegraphScale: 0.9, openingScale: 0.92, actionDelay: 0.82, enemySpeedScale: 1.08, attackOffset: 2 },
  { telegraphScale: 0.84, openingScale: 0.86, actionDelay: 0.72, enemySpeedScale: 1.16, attackOffset: 1 },
  { telegraphScale: 0.78, openingScale: 0.82, actionDelay: 0.62, enemySpeedScale: 1.24, attackOffset: 0 }
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha;

const lengthOf = (vector: Vec2) => Math.hypot(vector.x, vector.z);

const normalize = (vector: Vec2): Vec2 => {
  const length = lengthOf(vector);
  if (length <= 0.0001) {
    return { x: 0, z: 0 };
  }

  return {
    x: vector.x / length,
    z: vector.z / length
  };
};

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

const moveTowards = (current: Vec2, target: Vec2, maxDistance: number): Vec2 => {
  const delta = { x: target.x - current.x, z: target.z - current.z };
  const distance = lengthOf(delta);
  if (distance <= maxDistance || distance <= 0.0001) {
    return { x: target.x, z: target.z };
  }

  const ratio = maxDistance / distance;
  return {
    x: current.x + delta.x * ratio,
    z: current.z + delta.z * ratio
  };
};

const projectInsideArena = (position: Vec2, radius: number): Vec2 => {
  const length = lengthOf(position);
  const limit = ARENA_RADIUS - radius;
  if (length <= limit) {
    return position;
  }

  const normalized = normalize(position);
  return {
    x: normalized.x * limit,
    z: normalized.z * limit
  };
};

const createPlayerState = (): PlayerState => ({
  position: { x: -0.8, z: 2.7 },
  facing: -Math.PI / 2,
  state: "idle",
  velocity: { x: 0, z: 0 },
  attackCooldown: 0,
  strikeTimer: 0
});

const createEnemyState = (tuning: RoundTuning = roundTunings[0]): EnemyState => ({
  position: { x: 0.85, z: -1.9 },
  facing: Math.PI / 2,
  state: "idle",
  telegraphType: "none",
  telegraphTimer: 0,
  vulnerableTimer: 0,
  actionCooldown: tuning.actionDelay,
  orbitDirection: 1,
  attackIndex: 0,
  attackForward: { x: 0, z: 1 },
  attackAnchor: { x: 0, z: 0 }
});

export class CombatController {
  private mode: CombatMode = "title";

  private result: CombatResult = "pending";

  private runComplete = false;

  private round = 1;

  private score = 0;

  private streak = 0;

  private misses = 0;

  private elapsed = 0;

  private resolvedElapsed = 0;

  private player: PlayerState = createPlayerState();

  private enemy: EnemyState = createEnemyState();

  step(dt: number, input: CombatInput): void {
    if (this.mode === "title") {
      if (input.attackPressed || Math.abs(input.moveX) > 0.2 || Math.abs(input.moveZ) > 0.2) {
        this.startRun();
      }
      return;
    }

    if (this.mode === "resolved") {
      this.resolvedElapsed += dt;
      this.updateResolved(dt);

      const pressedAfterLock =
        this.resolvedElapsed >= RESOLVED_INPUT_LOCK &&
        (input.attackPressed || Math.abs(input.moveX) > 0.2 || Math.abs(input.moveZ) > 0.2);
      const autoAdvance = this.resolvedElapsed >= ROUND_ADVANCE_DELAY && !this.runComplete;

      if (pressedAfterLock || autoAdvance) {
        if (this.runComplete) {
          this.startRun();
        } else if (this.result === "success") {
          this.startRound(this.round + 1);
        } else {
          this.startRound(this.round);
        }
      }
      return;
    }

    this.elapsed += dt;
    this.updatePlayer(dt, input);
    this.updateEnemy(dt);

    if (input.attackPressed) {
      this.handlePlayerAttack();
    }

    this.syncFacing();
  }

  getSnapshot(viewportMode: ViewportMode): CombatSnapshot {
    const camera = this.computeCamera(viewportMode);
    const distance = distanceBetween(this.player.position, this.enemy.position);
    const enemyVulnerable = this.enemy.state === "vulnerable";
    const telegraphProgress =
      this.enemy.telegraphType === "none"
        ? 0
        : clamp(
            this.enemy.telegraphTimer /
              this.getTelegraphDuration(this.enemy.telegraphType),
            0,
            1
          );

    return {
      mode: this.mode,
      result: this.result,
      runComplete: this.runComplete,
      title: this.getTitle(),
      subtitle: this.getSubtitle(distance),
      hint: this.getHint(),
      nextAction: this.getNextAction(distance),
      round: this.round,
      maxRounds: MAX_ROUNDS,
      score: this.score,
      streak: this.streak,
      misses: this.misses,
      maxMisses: MAX_MISSES,
      player: {
        x: this.player.position.x,
        z: this.player.position.z,
        facing: this.player.facing,
        state: this.player.state,
        attackCooldown: this.player.attackCooldown,
        radius: PLAYER_RADIUS
      },
      enemy: {
        x: this.enemy.position.x,
        z: this.enemy.position.z,
        facing: this.enemy.facing,
        state: this.enemy.state,
        telegraphType: this.enemy.telegraphType,
        telegraphProgress,
        vulnerable: enemyVulnerable,
        radius: ENEMY_RADIUS
      },
      camera,
      elapsed: this.mode === "resolved" ? this.resolvedElapsed : this.elapsed,
      arenaRadius: ARENA_RADIUS
    };
  }

  private startRun() {
    this.round = 1;
    this.score = 0;
    this.streak = 0;
    this.misses = 0;
    this.runComplete = false;
    this.startRound(1);
  }

  private startRound(round: number) {
    this.mode = "combat";
    this.result = "pending";
    this.round = clamp(Math.round(round), 1, MAX_ROUNDS);
    this.runComplete = false;
    this.elapsed = 0;
    this.resolvedElapsed = 0;
    this.player = createPlayerState();
    this.enemy = createEnemyState(this.getTuning());
    this.syncFacing();
  }

  private updateResolved(dt: number) {
    this.player.velocity.x = lerp(this.player.velocity.x, 0, 0.18);
    this.player.velocity.z = lerp(this.player.velocity.z, 0, 0.18);
    this.player.position = projectInsideArena(
      {
        x: this.player.position.x + this.player.velocity.x * dt,
        z: this.player.position.z + this.player.velocity.z * dt
      },
      PLAYER_RADIUS
    );

    if (this.result === "success") {
      this.enemy.state = "down";
      this.enemy.position = moveTowards(
        this.enemy.position,
        { x: this.enemy.position.x + 0.55, z: this.enemy.position.z - 0.42 },
        dt * 0.9
      );
      this.player.state = "strike";
    } else {
      this.player.state = "hit";
      this.enemy.state = "attack";
      this.enemy.position = moveTowards(
        this.enemy.position,
        { x: 0.25, z: -0.4 },
        dt * 1.2
      );
    }

    this.syncFacing();
  }

  private updatePlayer(dt: number, input: CombatInput) {
    if (this.player.attackCooldown > 0) {
      this.player.attackCooldown = Math.max(0, this.player.attackCooldown - dt);
    }

    if (this.player.strikeTimer > 0) {
      this.player.strikeTimer = Math.max(0, this.player.strikeTimer - dt);
      this.player.state = this.player.strikeTimer > 0 ? "strike" : "idle";
    }

    const movement = normalize({ x: input.moveX, z: input.moveZ });
    const targetVelocity = {
      x: movement.x * PLAYER_SPEED,
      z: movement.z * PLAYER_SPEED
    };

    const smoothing = movement.x !== 0 || movement.z !== 0 ? 0.22 : 0.14;
    this.player.velocity.x = lerp(this.player.velocity.x, targetVelocity.x, smoothing);
    this.player.velocity.z = lerp(this.player.velocity.z, targetVelocity.z, smoothing);

    this.player.position = projectInsideArena(
      {
        x: this.player.position.x + this.player.velocity.x * dt,
        z: this.player.position.z + this.player.velocity.z * dt
      },
      PLAYER_RADIUS
    );

    if (this.player.state !== "strike" && this.player.state !== "hit") {
      this.player.state =
        Math.abs(this.player.velocity.x) > 0.18 || Math.abs(this.player.velocity.z) > 0.18
          ? "move"
          : "idle";
    }
  }

  private updateEnemy(dt: number) {
    const tuning = this.getTuning();

    if (this.enemy.state === "vulnerable") {
      this.enemy.vulnerableTimer = Math.max(0, this.enemy.vulnerableTimer - dt);
      if (this.enemy.vulnerableTimer <= 0) {
        this.enemy.state = "idle";
        this.enemy.telegraphType = "none";
        this.enemy.telegraphTimer = 0;
        this.enemy.actionCooldown = tuning.actionDelay * 0.62;
      }
      return;
    }

    if (this.enemy.state === "telegraph") {
      this.enemy.telegraphTimer += dt;
      this.updateEnemyTelegraphMotion(dt);

      const duration = this.getTelegraphDuration(
        this.enemy.telegraphType as Exclude<TelegraphType, "none">
      );
      if (this.enemy.telegraphTimer >= duration) {
        this.resolveEnemyAttack();
      }
      return;
    }

    if (this.enemy.state === "attack") {
      this.updateEnemyAttackMotion(dt);
      return;
    }

    this.enemy.actionCooldown -= dt;
    this.updateEnemyIdleMotion(dt);

    if (this.enemy.actionCooldown <= 0) {
      this.beginNextTelegraph();
    }
  }

  private updateEnemyIdleMotion(dt: number) {
    const tuning = this.getTuning();
    const toPlayer = {
      x: this.player.position.x - this.enemy.position.x,
      z: this.player.position.z - this.enemy.position.z
    };
    const distance = Math.max(0.001, lengthOf(toPlayer));
    const forward = { x: toPlayer.x / distance, z: toPlayer.z / distance };
    const right = { x: -forward.z, z: forward.x };

    const desiredDistance = 2.55;
    const distanceError = distance - desiredDistance;
    const orbitAmount = this.enemy.orbitDirection * 0.82;
    const target = {
      x:
        this.player.position.x -
        forward.x * desiredDistance +
        right.x * orbitAmount,
      z:
        this.player.position.z -
        forward.z * desiredDistance +
        right.z * orbitAmount
    };

    const corrected = {
      x: target.x - forward.x * distanceError * 0.25,
      z: target.z - forward.z * distanceError * 0.25
    };

    this.enemy.position = projectInsideArena(
      moveTowards(this.enemy.position, corrected, ENEMY_SPEED * tuning.enemySpeedScale * dt),
      ENEMY_RADIUS
    );
    this.enemy.state = "move";
  }

  private beginNextTelegraph() {
    const tuning = this.getTuning();
    const telegraphType =
      attackOrder[(this.enemy.attackIndex + tuning.attackOffset) % attackOrder.length];
    this.enemy.attackForward = normalize({
      x: this.player.position.x - this.enemy.position.x,
      z: this.player.position.z - this.enemy.position.z
    });
    this.enemy.attackAnchor = { ...this.player.position };
    this.enemy.attackIndex += 1;
    this.enemy.orbitDirection = this.enemy.orbitDirection === 1 ? -1 : 1;
    this.enemy.telegraphType = telegraphType;
    this.enemy.telegraphTimer = 0;
    this.enemy.state = "telegraph";
  }

  private updateEnemyTelegraphMotion(dt: number) {
    const attack = this.enemy.telegraphType;
    const forward = this.enemy.attackForward;
    const right = { x: -forward.z, z: forward.x };
    const progress =
      this.enemy.telegraphType === "none"
        ? 0
        : clamp(
            this.enemy.telegraphTimer /
              this.getTelegraphDuration(attack as Exclude<TelegraphType, "none">),
            0,
            1
          );

    let target = this.enemy.position;
    if (attack === "dash") {
      target = {
        x: this.enemy.attackAnchor.x - forward.x * 3.1,
        z:
          this.enemy.attackAnchor.z -
          forward.z * 3.1 +
          right.z * this.enemy.orbitDirection * 0.45
      };
    } else if (attack === "sweep") {
      target = {
        x:
          this.enemy.attackAnchor.x -
          forward.x * 2.2 +
          right.x * this.enemy.orbitDirection * 1.25,
        z:
          this.enemy.attackAnchor.z -
          forward.z * 2.2 +
          right.z * this.enemy.orbitDirection * 1.25
      };
    } else if (attack === "slam") {
      target = {
        x: this.enemy.attackAnchor.x - forward.x * 1.62,
        z: this.enemy.attackAnchor.z - forward.z * 1.62
      };
    }

    const tuning = this.getTuning();
    const speedBoost = attack === "slam" ? 1.25 : 1;
    this.enemy.position = projectInsideArena(
      moveTowards(
        this.enemy.position,
        target,
        ENEMY_SPEED * tuning.enemySpeedScale * speedBoost * dt
      ),
      ENEMY_RADIUS
    );

    if (progress > 0.78 && attack === "dash") {
      this.enemy.state = "attack";
    }
  }

  private updateEnemyAttackMotion(dt: number) {
    if (this.result !== "pending") {
      return;
    }

    if (this.enemy.telegraphType !== "none") {
      this.enemy.telegraphTimer += dt;
    }

    const toPlayer = {
      x: this.player.position.x - this.enemy.position.x,
      z: this.player.position.z - this.enemy.position.z
    };
    const forward =
      this.enemy.telegraphType === "none" ? normalize(toPlayer) : this.enemy.attackForward;
    const tuning = this.getTuning();
    this.enemy.position = projectInsideArena(
      {
        x: this.enemy.position.x + forward.x * dt * 5.8 * tuning.enemySpeedScale,
        z: this.enemy.position.z + forward.z * dt * 5.8 * tuning.enemySpeedScale
      },
      ENEMY_RADIUS
    );

    const attack =
      this.enemy.telegraphType === "none" ? null : this.enemy.telegraphType;
    const distance = distanceBetween(this.player.position, this.enemy.position);
    if (
      (attack && this.enemy.telegraphTimer >= this.getTelegraphDuration(attack) * 1.12) ||
      distance <= PLAYER_RADIUS + ENEMY_RADIUS + 0.08
    ) {
      this.resolveEnemyAttack();
    }
  }

  private resolveEnemyAttack() {
    const attack = this.enemy.telegraphType;
    const toAnchor = {
      x: this.player.position.x - this.enemy.attackAnchor.x,
      z: this.player.position.z - this.enemy.attackAnchor.z
    };
    const forward = this.enemy.attackForward;
    const right = { x: -forward.z, z: forward.x };
    const lateral = toAnchor.x * right.x + toAnchor.z * right.z;
    const depth = toAnchor.x * forward.x + toAnchor.z * forward.z;

    let safe = false;
    if (attack === "dash") {
      safe = Math.abs(lateral) > 1.15;
    } else if (attack === "sweep") {
      safe = depth > 1.15;
    } else if (attack === "slam") {
      safe = depth < -0.65 && Math.abs(lateral) < 0.92;
    }

    if (safe) {
      this.enemy.state = "vulnerable";
      this.enemy.vulnerableTimer = this.getTelegraphOpening(
        attack as Exclude<TelegraphType, "none">
      );
      return;
    }

    this.registerMiss();
    this.result = "fail";
    this.mode = "resolved";
    this.resolvedElapsed = 0;
    this.player.state = "hit";
    this.enemy.state = "attack";
  }

  private handlePlayerAttack() {
    if (this.mode !== "combat" || this.player.attackCooldown > 0) {
      return;
    }

    this.player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
    this.player.strikeTimer = PLAYER_STRIKE_TIME;
    this.player.state = "strike";

    const distance = distanceBetween(this.player.position, this.enemy.position);
    if (this.enemy.state === "vulnerable" && distance <= PLAYER_ATTACK_RANGE) {
      this.registerSuccess();
      this.result = "success";
      this.mode = "resolved";
      this.resolvedElapsed = 0;
      this.enemy.state = "down";
      this.enemy.telegraphType = "none";
      this.enemy.vulnerableTimer = 0;
    }
  }

  private registerSuccess() {
    const timeBonus = Math.max(0, Math.round((16 - this.elapsed) * 45));
    const streakBonus = (this.streak + 1) * 180;
    this.streak += 1;
    this.score += this.round * 1000 + timeBonus + streakBonus;
    this.runComplete = this.round >= MAX_ROUNDS;
  }

  private registerMiss() {
    this.misses = Math.min(MAX_MISSES, this.misses + 1);
    this.streak = 0;
    this.score = Math.max(0, this.score - 240);
    this.runComplete = this.misses >= MAX_MISSES;
  }

  private getTuning() {
    return roundTunings[Math.max(0, Math.min(roundTunings.length - 1, this.round - 1))];
  }

  private getTelegraphDuration(type: Exclude<TelegraphType, "none">) {
    return telegraphDurations[type] * this.getTuning().telegraphScale;
  }

  private getTelegraphOpening(type: Exclude<TelegraphType, "none">) {
    return telegraphOpenings[type] * this.getTuning().openingScale;
  }

  private syncFacing() {
    const playerToEnemy = Math.atan2(
      this.enemy.position.x - this.player.position.x,
      this.enemy.position.z - this.player.position.z
    );
    const enemyToPlayer = Math.atan2(
      this.player.position.x - this.enemy.position.x,
      this.player.position.z - this.enemy.position.z
    );

    this.player.facing = playerToEnemy;
    this.enemy.facing = enemyToPlayer;
  }

  private getTitle() {
    if (this.mode === "title") {
      return "月下ノ刃";
    }

    if (this.mode === "resolved") {
      if (this.runComplete && this.result === "success") return "制覇";
      if (this.runComplete && this.result === "fail") return "終幕";
      return this.result === "success" ? "一閃" : "被太刀";
    }

    if (this.enemy.state === "vulnerable") {
      return "隙";
    }

    const type = this.enemy.telegraphType;
    if (type === "dash") return "直線突進";
    if (type === "sweep") return "横薙ぎ";
    if (type === "slam") return "踏み込み斬り";

    return "間合い";
  }

  private getSubtitle(distance: number) {
    if (this.mode === "title") {
      return "Move / Tap で開戦";
    }

    if (this.mode === "resolved") {
      if (this.runComplete && this.result === "success") {
        return `五連斬り達成 Score ${this.score}`;
      }
      if (this.runComplete && this.result === "fail") {
        return `三度斬られた。Score ${this.score}`;
      }
      return this.result === "success"
        ? `Round ${this.round} clear. 次へ`
        : `Miss ${this.misses}/${MAX_MISSES}. まだ終わってない`;
    }

    if (this.enemy.state === "vulnerable") {
      return distance <= PLAYER_ATTACK_RANGE ? "今なら届く" : "詰めてから斬れ";
    }

    return "敵を見て、正しい方向へ外せ";
  }

  private getHint() {
    if (this.mode === "title") {
      return "左で移動、右で斬る。赤を外して白い隙を刺せ";
    }

    if (this.mode === "resolved") {
      if (this.runComplete) {
        return "Tap / Move で新しい走り";
      }
      return this.result === "success" ? "次の刺客へ" : "同じ太刀筋を見切れ";
    }

    if (this.enemy.state === "vulnerable") {
      return "隙が開いた。近づいて斬れ";
    }

    if (this.enemy.telegraphType === "dash") {
      return "直線突進: 横へ逃げろ";
    }

    if (this.enemy.telegraphType === "sweep") {
      return "横薙ぎ: 後ろへ下がれ";
    }

    if (this.enemy.telegraphType === "slam") {
      return "踏み込み斬り: 内側へ潜れ";
    }

    return "間合いを維持して、次の予兆を待て";
  }

  private getNextAction(distance: number) {
    if (this.mode === "title") {
      return "Move / Tap で開戦";
    }

    if (this.mode === "resolved") {
      if (this.runComplete) return "Tap / Move で再走";
      return this.result === "success" ? "次ラウンドへ" : "再挑戦";
    }

    if (this.enemy.state === "vulnerable") {
      return distance <= PLAYER_ATTACK_RANGE ? "今斬れ" : "詰めろ";
    }

    if (this.enemy.telegraphType === "dash") return "横へ逃げろ";
    if (this.enemy.telegraphType === "sweep") return "後ろへ下がれ";
    if (this.enemy.telegraphType === "slam") return "内側へ潜れ";

    return "赤を待て";
  }

  private computeCamera(viewportMode: ViewportMode): CameraSnapshot {
    const toEnemy = {
      x: this.enemy.position.x - this.player.position.x,
      z: this.enemy.position.z - this.player.position.z
    };
    const forward = normalize(toEnemy);
    const right = { x: -forward.z, z: forward.x };
    const distance = clamp(lengthOf(toEnemy), 2.4, 5.6);
    const basePull = viewportMode === "portrait" ? 4.9 : viewportMode === "tablet" ? 4.5 : 4.1;
    const sidePull = viewportMode === "portrait" ? 1.25 : 1.55;
    const height = viewportMode === "portrait" ? 5.3 : viewportMode === "tablet" ? 4.8 : 4.45;
    const zoomPull = distance * 0.38;
    const centerX = lerp(this.player.position.x, this.enemy.position.x, 0.48);
    const centerZ = lerp(this.player.position.z, this.enemy.position.z, 0.48);

    return {
      x:
        this.player.position.x -
        forward.x * (basePull + zoomPull) -
        right.x * sidePull,
      y: height + distance * 0.16,
      z:
        this.player.position.z -
        forward.z * (basePull + zoomPull) -
        right.z * sidePull,
      lookAtX: centerX,
      lookAtY: 1.4,
      lookAtZ: centerZ
    };
  }
}

export const renderCombatSnapshotToText = (snapshot: CombatSnapshot) =>
  JSON.stringify({
    coordinateSystem: "Top-down arena coordinates. Origin is arena center. +x is screen-right, +z is toward the far side of the arena.",
    mode: snapshot.mode,
    result: snapshot.result,
    runComplete: snapshot.runComplete,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    hint: snapshot.hint,
    nextAction: snapshot.nextAction,
    run: {
      round: snapshot.round,
      maxRounds: snapshot.maxRounds,
      score: snapshot.score,
      streak: snapshot.streak,
      misses: snapshot.misses,
      maxMisses: snapshot.maxMisses
    },
    player: {
      x: Number(snapshot.player.x.toFixed(2)),
      z: Number(snapshot.player.z.toFixed(2)),
      facing: Number(snapshot.player.facing.toFixed(2)),
      state: snapshot.player.state,
      attackCooldown: Number(snapshot.player.attackCooldown.toFixed(2))
    },
    enemy: {
      x: Number(snapshot.enemy.x.toFixed(2)),
      z: Number(snapshot.enemy.z.toFixed(2)),
      facing: Number(snapshot.enemy.facing.toFixed(2)),
      state: snapshot.enemy.state,
      telegraphType: snapshot.enemy.telegraphType,
      telegraphProgress: Number(snapshot.enemy.telegraphProgress.toFixed(2)),
      vulnerable: snapshot.enemy.vulnerable
    },
    camera: {
      x: Number(snapshot.camera.x.toFixed(2)),
      y: Number(snapshot.camera.y.toFixed(2)),
      z: Number(snapshot.camera.z.toFixed(2)),
      lookAtX: Number(snapshot.camera.lookAtX.toFixed(2)),
      lookAtY: Number(snapshot.camera.lookAtY.toFixed(2)),
      lookAtZ: Number(snapshot.camera.lookAtZ.toFixed(2))
    }
  });
