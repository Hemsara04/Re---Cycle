import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ARRIVAL_EASE,
  CAMERA,
  FLIGHT_DURATION,
  PHASES,
  SCRUB,
} from "@/components/WasteScene/config";
import type { WasteSceneApi } from "@/components/WasteScene";
import { mulberry32 } from "@/lib/noise";

gsap.registerPlugin(ScrollTrigger);

export type Overlay = {
  intro: HTMLElement;
  caption: HTMLElement;
  finale: HTMLElement;
};

type Options = {
  trigger: HTMLElement;
  scene: WasteSceneApi;
  overlay: Overlay;
  mobile: boolean;
};

const span = ([a, b]: readonly [number, number]) => b - a;

/**
 * One master timeline, 1 unit long, scrubbed by the section's scroll progress.
 * Every position below is a fraction of the scroll distance (see PHASES).
 */
export function buildTimeline(tl: gsap.core.Timeline, { scene, overlay, mobile }: Omit<Options, "trigger">) {
  const { state, pieces } = scene;
  const rand = mulberry32(99);
  const shift = mobile ? CAMERA.finaleShiftMobile : CAMERA.finaleShiftDesktop;

  // Pin the timeline length to exactly 1 so positions == scroll fractions
  tl.set({}, {}, 1);

  // ── 1. Opening: problem copy leaves, camera starts to push in ──
  tl.to(overlay.intro, { autoAlpha: 0, y: -40, ease: "power1.in", duration: span(PHASES.introTextOut) }, PHASES.introTextOut[0]);
  tl.to(state, { camZ: CAMERA.assembled.z, camY: CAMERA.assembled.y, ease: "power2.inOut", duration: 0.62 }, 0.04);

  // ── 2. Assembly: every piece flies its own curve, staggered ──
  const schedule = (list: typeof pieces, [a, b]: readonly [number, number]) => {
    // random order, but spread evenly across the window
    const order = list.map((p) => ({ p, k: rand() })).sort((x, y) => x.k - y.k);
    order.forEach(({ p }, i) => {
      const at = a + (i / Math.max(1, order.length - 1)) * (b - a) + (rand() - 0.5) * 0.02;
      const dur = FLIGHT_DURATION[0] + rand() * (FLIGHT_DURATION[1] - FLIGHT_DURATION[0]);
      tl.to(p, { t: 1, ease: ARRIVAL_EASE, duration: Math.min(dur, PHASES.assembly[1] - at) }, at);
    });
  };
  schedule(pieces.filter((p) => !p.filler), PHASES.heroArrivals);
  schedule(pieces.filter((p) => p.filler), PHASES.fillerArrivals);

  tl.to(state, { core: 1, ease: "power2.out", duration: 0.3 }, 0.32);
  tl.to(state, { shadow: 1, ease: "none", duration: 0.4 }, 0.25);

  tl.fromTo(overlay.caption, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.05 }, PHASES.midCaption[0]);
  tl.to(overlay.caption, { autoAlpha: 0, y: -24, duration: 0.05 }, PHASES.midCaption[1] - 0.05);

  // ── 3. Transformation: dirty → clean, green rim lights up ──
  tl.to(state, { clean: 1, ease: "power1.inOut", duration: span(PHASES.transform) }, PHASES.transform[0]);
  tl.to(state, { glow: 1, ease: "power2.in", duration: span(PHASES.transform) }, PHASES.transform[0]);
  tl.to(state, { spin: 1, ease: "none", duration: 0.2 }, PHASES.transform[0]);

  // ── 4. Finale: pull back, sphere slides aside, headline in ──
  tl.to(
    state,
    { camZ: CAMERA.finale.z, camY: CAMERA.finale.y, shiftX: shift.x, shiftY: shift.y, ease: "power2.inOut", duration: span(PHASES.finale) },
    PHASES.finale[0],
  );
  tl.fromTo(overlay.finale, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, ease: "power2.out", duration: 0.06 }, PHASES.finale[0] + 0.03);

  return tl;
}

/** Scroll-driven version. Returns a cleanup function. */
export function createMasterTimeline({ trigger, ...rest }: Options) {
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger,
      start: "top top",
      end: "bottom bottom",
      scrub: SCRUB,
      invalidateOnRefresh: true,
    },
  });
  buildTimeline(tl, rest);
  return () => {
    tl.scrollTrigger?.kill();
    tl.kill();
  };
}

/** Reduced motion: jump straight to the finished frame. */
export function applyFinalFrame(opts: Omit<Options, "trigger">) {
  const tl = buildTimeline(gsap.timeline({ paused: true }), opts);
  tl.progress(1);
  return () => tl.kill();
}
