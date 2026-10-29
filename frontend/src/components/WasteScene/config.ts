/**
 * Every knob for the "waste becomes value" scene lives here.
 * Scroll positions are fractions (0–1) of the section's total scroll distance.
 */

export type Tier = "high" | "medium" | "low";

// ─── Scroll & phases ─────────────────────────────────────────────────────────
export const SCROLL_LENGTH_VH = 500; // total height of the pinned section
export const SCRUB = 0.6; // seconds the animation takes to catch up (Lenis already eases the scroll itself)

export const PHASES = {
  introTextOut: [0.04, 0.1], // problem copy fades out
  assembly: [0.1, 0.7], // pieces fly in and lock onto the sphere
  heroArrivals: [0.1, 0.52], // window in which the big pieces *start* flying
  fillerArrivals: [0.3, 0.62], // caps/shards start flying (fill the gaps)
  midCaption: [0.3, 0.62], // "piece by piece" caption visible
  transform: [0.7, 0.9], // dirty → clean, green rim
  finale: [0.9, 1.0], // camera pulls back, headline in
} as const;

export const FLIGHT_DURATION = [0.1, 0.17]; // per-piece flight length (min, max), in timeline units
export const ARRIVAL_EASE = "back.out(1.5)"; // overshoot past the sphere surface, then settle
export const FLIGHT_SPIN = Math.PI * 3; // extra tumbling while flying (radians)

// ─── Piece counts per device tier ────────────────────────────────────────────
// "hero" = recognisable objects (cans, boxes, bottles…), "filler" = caps and shards.
export const PIECE_COUNTS: Record<Tier, { hero: number; filler: number }> = {
  high: { hero: 60, filler: 280 },
  medium: { hero: 48, filler: 170 },
  low: { hero: 34, filler: 90 },
};

// Relative share of each hero type (normalised at runtime)
export const HERO_MIX = {
  can: 9,
  cardboard: 7,
  petBottle: 10,
  glassBottle: 7,
  oilJug: 5,
  paperBall: 8,
  circuitBoard: 4,
} as const;
export type HeroKind = keyof typeof HERO_MIX;

// ─── Geometry of the final form ──────────────────────────────────────────────
export const SPHERE_RADIUS = 2.2;
export const PIECE_SIZE = 0.78; // longest side of a hero piece, before random variation
export const SIZE_JITTER = 0.22; // ± fraction
export const FILLER_SIZE = 0.2;

// Where the cloud lives at scroll 0
export const CLOUD = { x: 11, y: 6, zNear: 5, zFar: -10 };
export const IDLE_DRIFT = 0.35; // amplitude of the floating motion while scattered

// ─── Camera ──────────────────────────────────────────────────────────────────
export const CAMERA = {
  fov: 35,
  start: { z: 16, y: 0.4 },
  assembled: { z: 9.5, y: 0.2 },
  finale: { z: 12.5, y: 0.6 },
  // During the finale the sphere slides aside so the headline has room
  finaleShiftDesktop: { x: -3.4, y: 0 },
  finaleShiftMobile: { x: 0, y: -2.4 },
  parallax: { x: 0.45, y: 0.3, damping: 0.05 },
};

// ─── Look ────────────────────────────────────────────────────────────────────
export const COLORS = {
  background: "#060908",
  backdropGlow: "#12241b",
  keyLight: "#fff3e2",
  rimLight: "#d6e6ff", // cool white; the green belongs to the "clean" phase
  glow: "#3ddc84", // emissive rim on the clean sphere
  dirt: "#4a3b2a",
};

export const LIGHTS = {
  envIntensity: 0.55,
  keyIntensity: 2.4,
  rimIntensity: 2.4,
};

export const GLOW_STRENGTH = 1.35; // peak emissive multiplier of the rim (HDR, feeds bloom)
export const SPHERE_SPIN = 0.12; // rad/s idle rotation once assembled

export const HDRI_URL = "/hdri/studio_small_09_1k.hdr";
export const MODEL_URLS = {
  can: "/models/can_rusted.glb",
  cardboard: "/models/cardboard_box_01.glb",
  oilJug: "/models/plastic_bottle_gallon.glb",
  circuitBoard: "/models/circuit_board.glb",
} as const;

// ─── Per-tier rendering settings ─────────────────────────────────────────────
export const TIER_SETTINGS: Record<
  Tier,
  { dpr: number; post: boolean; dof: boolean; bloom: boolean; grain: boolean; shadows: number; transmission: boolean; msaa: number }
> = {
  high: { dpr: 2, post: true, dof: true, bloom: true, grain: true, shadows: 2048, transmission: true, msaa: 2 },
  medium: { dpr: 1.5, post: true, dof: false, bloom: true, grain: true, shadows: 1024, transmission: true, msaa: 2 },
  low: { dpr: 1.25, post: false, dof: false, bloom: false, grain: false, shadows: 0, transmission: false, msaa: 0 },
};
export const MOBILE_DPR_CAP = 1.5;

// Adaptive quality: if the frame rate stays under FPS_FLOOR, render resolution steps down by
// DPR_STEP (to DPR_MIN), then depth of field is dropped, then all post effects.
// If it comfortably exceeds FPS_RECOVER, resolution steps back up.
export const FPS_FLOOR = 50;
export const FPS_RECOVER = 58;
export const DPR_STEP = 0.25;
export const DPR_MIN = 1;
