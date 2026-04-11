export type CombatMode = "title" | "combat" | "resolved";

export type CombatResult = "pending" | "success" | "fail";

export type ViewportMode = "desktop" | "tablet" | "portrait";

export type TelegraphType = "none" | "dash" | "sweep" | "slam";

export type ActorState =
  | "idle"
  | "move"
  | "telegraph"
  | "attack"
  | "vulnerable"
  | "strike"
  | "hit"
  | "down";

export interface PlayerSnapshot {
  x: number;
  z: number;
  facing: number;
  state: ActorState;
  attackCooldown: number;
  radius: number;
}

export interface EnemySnapshot {
  x: number;
  z: number;
  facing: number;
  state: ActorState;
  telegraphType: TelegraphType;
  telegraphProgress: number;
  vulnerable: boolean;
  radius: number;
}

export interface CameraSnapshot {
  x: number;
  y: number;
  z: number;
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
}

export interface CombatSnapshot {
  mode: CombatMode;
  result: CombatResult;
  runComplete: boolean;
  title: string;
  subtitle: string;
  hint: string;
  nextAction: string;
  round: number;
  maxRounds: number;
  score: number;
  streak: number;
  misses: number;
  maxMisses: number;
  player: PlayerSnapshot;
  enemy: EnemySnapshot;
  camera: CameraSnapshot;
  elapsed: number;
  arenaRadius: number;
}

export interface CombatInput {
  moveX: number;
  moveZ: number;
  attackPressed: boolean;
}
