import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { radialTexture } from "@/components/WastePieces/textures";
import {
  CAMERA,
  COLORS,
  DPR_MIN,
  DPR_STEP,
  FPS_FLOOR,
  FPS_RECOVER,
  HDRI_URL,
  LIGHTS,
  MOBILE_DPR_CAP,
  type Tier,
  TIER_SETTINGS,
} from "@/components/WasteScene/config";
import { createPost, type Post } from "@/components/WasteScene/postprocessing";

/**
 * The shared "studio" every scroll scene on the site renders in: renderer, camera,
 * HDRI + key/rim lights, dark backdrop, post-processing, resize handling, mouse
 * parallax, an on-screen-only render loop and adaptive quality.
 * Scenes add their own objects and pass an `onFrame` callback.
 */
export type StageOptions = {
  canvas: HTMLCanvasElement;
  tier: Tier;
  mobile: boolean;
  /** Static frame: no render loop, no parallax. */
  still?: boolean;
  fov?: number;
  /** fov multiplier on portrait screens, so the subject keeps a similar size */
  portraitFov?: number;
  /** key light shadow frustum half-size */
  shadowExtent?: number;
};

export type FrameInfo = { time: number; dt: number; pointer: { x: number; y: number } };

export type Stage = Awaited<ReturnType<typeof createStage>>;

export async function createStage({
  canvas,
  tier,
  mobile,
  still = false,
  fov = CAMERA.fov,
  portraitFov = 1.45,
  shadowExtent = 5,
}: StageOptions) {
  const settings = { ...TIER_SETTINGS[tier] };

  // ── renderer ──
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !settings.post, // the composer does MSAA itself
    powerPreference: "high-performance",
    preserveDrawingBuffer: still,
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = settings.shadows > 0;
  renderer.shadowMap.type = THREE.PCFShadowMap; // soft (filtered) by default since r18x

  // Render resolution starts at the tier cap and adapts to the measured frame rate.
  const maxDpr = Math.min(window.devicePixelRatio, settings.dpr, mobile ? MOBILE_DPR_CAP : Infinity);
  let currentDpr = maxDpr;

  // ── scene + studio backdrop ──
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 50),
    new THREE.MeshBasicMaterial({ map: radialTexture(COLORS.backdropGlow, COLORS.background), depthWrite: false, toneMapped: false }),
  );
  backdrop.position.set(0, 1, -22);
  scene.add(backdrop);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 120);

  // ── lights: HDRI for reflections/ambient + one soft key + one rim ──
  const key = new THREE.DirectionalLight(COLORS.keyLight, LIGHTS.keyIntensity);
  key.position.set(-5, 7, 6);
  key.castShadow = settings.shadows > 0;
  if (key.castShadow) {
    key.shadow.mapSize.setScalar(settings.shadows);
    key.shadow.camera.left = key.shadow.camera.bottom = -shadowExtent;
    key.shadow.camera.right = key.shadow.camera.top = shadowExtent;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
  }
  const rim = new THREE.DirectionalLight(COLORS.rimLight, LIGHTS.rimIntensity);
  rim.position.set(3, 2.5, -7);
  scene.add(key, rim);

  let env: THREE.Texture | null = null;
  const loadEnvironment = (onProgress: (f: number) => void) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    return new HDRLoader()
      .loadAsync(HDRI_URL, (e) => e.total && onProgress(e.loaded / e.total))
      .then((hdr) => {
        const tex = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        return tex;
      })
      .catch(() => pmrem.fromScene(new RoomEnvironment(), 0.04).texture) // offline fallback
      .then((tex) => {
        env = tex;
        scene.environment = tex;
        scene.environmentIntensity = LIGHTS.envIntensity;
      })
      .finally(() => pmrem.dispose());
  };

  // ── post ──
  let post: Post | null = settings.post ? createPost(renderer, scene, camera, settings) : null;

  // ── sizing ──
  const host = canvas.parentElement!;
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(currentDpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? fov * portraitFov : fov;
    camera.updateProjectionMatrix();
    post?.setSize(w, h, currentDpr);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ── mouse parallax input (damped; scenes decide how to use it) ──
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!still) window.addEventListener("pointermove", onPointer, { passive: true });

  // ── per-frame ──
  let onFrame: (f: FrameInfo) => void = () => {};
  let focus: () => number = () => 10;
  let last = performance.now();
  const fps = { frames: 0, time: 0, warmup: 2, cooldown: 0 };

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const time = now / 1000;
    pointer.sx += (pointer.x - pointer.sx) * CAMERA.parallax.damping;
    pointer.sy += (pointer.y - pointer.sy) * CAMERA.parallax.damping;

    onFrame({ time: still ? 0 : time, dt, pointer: { x: pointer.sx, y: pointer.sy } });

    if (post) {
      post.setFocus(focus());
      post.render(time);
    } else {
      renderer.render(scene, camera);
    }

    // Adaptive quality: lower resolution first, then depth of field, then all post effects.
    // Steps back up when there's headroom (after a cooldown, so it doesn't oscillate).
    if (still || (fps.warmup -= dt) >= 0) return;
    fps.frames++;
    fps.time += dt;
    fps.cooldown -= dt;
    if (fps.time < 1.5) return;
    const rate = fps.frames / fps.time;
    fps.frames = fps.time = 0;
    if (rate < FPS_FLOOR) {
      fps.cooldown = 6;
      if (currentDpr > DPR_MIN) {
        currentDpr = Math.max(DPR_MIN, currentDpr - DPR_STEP);
        resize();
      } else if (post?.hasDof()) {
        post.dropDof();
      } else if (post) {
        post.dispose();
        post = null;
      }
    } else if (rate > FPS_RECOVER && currentDpr < maxDpr && fps.cooldown <= 0) {
      currentDpr = Math.min(maxDpr, currentDpr + DPR_STEP);
      resize();
    }
  };

  // ── loop: only runs while the canvas is on screen and the tab is visible ──
  let raf = 0;
  let running = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    frame(now);
  };
  const start = () => {
    if (running || still) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  let onScreen = false;
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !document.hidden) start();
    else stop();
  });
  io.observe(host);
  const onVisibility = () => (document.hidden ? stop() : onScreen && start());
  document.addEventListener("visibilitychange", onVisibility);

  const disposables: { dispose(): void }[] = [];

  return {
    renderer,
    scene,
    camera,
    settings,
    loadEnvironment,
    /** Called every frame before rendering. */
    setFrame(fn: (f: FrameInfo) => void) {
      onFrame = fn;
    },
    /** Distance the depth of field should keep sharp. */
    setFocus(fn: () => number) {
      focus = fn;
    },
    /** Register things to dispose with the stage. */
    track<T extends { dispose(): void }>(d: T) {
      disposables.push(d);
      return d;
    },
    /** Compile every shader up front so the first scroll doesn't hitch. */
    compile: () => renderer.compileAsync(scene, camera),
    renderOnce: () => frame(performance.now()),
    dispose() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      post?.dispose();
      disposables.forEach((d) => d.dispose());
      env?.dispose();
      backdrop.geometry.dispose();
      backdrop.material.map?.dispose();
      backdrop.material.dispose();
      renderer.dispose();
    },
  };
}

/** Dispose every geometry/material/texture under an object. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.geometry) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
      m.dispose();
    }
  });
}
