import * as THREE from "three";
import { createStage } from "@/components/three/stage";
import { WastePieces } from "@/components/WastePieces";
import { radialTexture } from "@/components/WastePieces/textures";
import { CAMERA, GLOW_STRENGTH, PIECE_COUNTS, SPHERE_RADIUS, SPHERE_SPIN, type Tier } from "./config";

/**
 * Everything the GSAP timeline animates. Plain numbers so GSAP can tween them;
 * the render loop reads them every frame.
 */
export type SceneState = {
  camZ: number;
  camY: number;
  shiftX: number; // finale framing offset (camera + look target move together)
  shiftY: number;
  core: number; // 0..1 inner sphere grows in during assembly
  clean: number; // 0..1 dirty → clean
  glow: number; // 0..1 rim glow
  spin: number; // 0..1 weight of the idle sphere rotation
  shadow: number; // 0..1 contact shadow strength
};

export type WasteSceneOptions = {
  canvas: HTMLCanvasElement;
  tier: Tier;
  mobile: boolean;
  /** Static final frame: no render loop, no parallax. */
  still?: boolean;
  onProgress?: (fraction: number) => void;
};

export type WasteSceneApi = Awaited<ReturnType<typeof createWasteScene>>;

export async function createWasteScene({ canvas, tier, mobile, still = false, onProgress }: WasteSceneOptions) {
  const stage = await createStage({ canvas, tier, mobile, still });
  const { scene, camera, settings } = stage;
  const counts = PIECE_COUNTS[tier];

  // ── load environment + pieces in parallel ──
  const progress = { env: 0, models: 0 };
  const report = () => onProgress?.(Math.min(0.95, progress.env * 0.5 + progress.models * 0.45));
  const [, pieces] = await Promise.all([
    stage.loadEnvironment((f) => {
      progress.env = f;
      report();
    }),
    WastePieces.create({
      hero: counts.hero,
      filler: counts.filler,
      transmission: settings.transmission,
      shadows: settings.shadows > 0,
      onProgress: (f) => {
        progress.models = f;
        report();
      },
    }),
  ]);
  stage.track(pieces);
  scene.add(pieces.group);

  // ── floor: real soft shadow (if enabled) + contact blob ──
  const floorY = -SPHERE_RADIUS - 1.3;
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.35 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = floorY;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.visible = settings.shadows > 0;
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, opacity: 0 }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = floorY + 0.01;
  scene.add(shadowCatcher, blob);
  for (const m of [shadowCatcher, blob]) {
    stage.track(m.geometry);
    stage.track(m.material);
  }
  stage.track(blob.material.map!);

  // ── state animated by the timeline ──
  const state: SceneState = {
    camZ: CAMERA.start.z,
    camY: CAMERA.start.y,
    shiftX: 0,
    shiftY: 0,
    core: 0,
    clean: 0,
    glow: 0,
    spin: 0,
    shadow: 0,
  };

  const lookAt = new THREE.Vector3();
  let spinAngle = 0;

  stage.setFocus(() => camera.position.distanceTo(pieces.group.position) - SPHERE_RADIUS * 0.5);
  stage.setFrame(({ time, dt, pointer }) => {
    camera.position.set(
      state.shiftX + pointer.x * CAMERA.parallax.x,
      state.camY + state.shiftY - pointer.y * CAMERA.parallax.y,
      state.camZ,
    );
    lookAt.set(state.shiftX, state.shiftY, 0);
    camera.lookAt(lookAt);

    // Only spin once there is a sphere to spin (accumulated, so scrubbing never jumps)
    spinAngle += dt * SPHERE_SPIN * state.core * (0.35 + state.spin);
    pieces.group.rotation.y = spinAngle;
    pieces.group.rotation.x = 0.18 * state.core;
    pieces.core.scale.setScalar(Math.max(0.001, state.core));
    pieces.uniforms.uClean.value = state.clean;
    pieces.uniforms.uGlow.value = state.glow * GLOW_STRENGTH;
    blob.material.opacity = state.shadow * 0.75;
    shadowCatcher.material.opacity = 0.12 + state.shadow * 0.28;
    pieces.update(time);
  });

  onProgress?.(0.96);
  await stage.compile();
  onProgress?.(1);

  return {
    state,
    pieces: pieces.pieces,
    /** Draw one frame now (used for the reduced-motion still). */
    renderOnce: stage.renderOnce,
    dispose: stage.dispose,
  };
}
