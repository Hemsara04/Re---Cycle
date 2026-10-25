import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HOW_PHASES as P } from "@/components/HowItWorks/config";
import type { HowSceneApi } from "@/components/HowItWorks";
import { SCRUB } from "@/components/WasteScene/config";
import { mulberry32 } from "@/lib/noise";

gsap.registerPlugin(ScrollTrigger);

export type HowOverlay = {
  title: HTMLElement;
  steps: [HTMLElement, HTMLElement, HTMLElement];
  rail: [HTMLElement, HTMLElement, HTMLElement]; // progress bar fill per step
  finale: HTMLElement;
};

const span = ([a, b]: readonly [number, number]) => b - a;

/**
 * Master timeline for "How it works", 1 unit long = the section's scroll distance.
 * Beats: title → step 1 (post) → phone becomes a pin → step 2 (map) → step 3 (handover) → finale.
 */
export function createHowTimeline({ trigger, scene, overlay }: { trigger: HTMLElement; scene: HowSceneApi; overlay: HowOverlay }) {
  const { state, shots, pins } = scene;
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger, start: "top top", end: "bottom bottom", scrub: SCRUB, invalidateOnRefresh: true },
  });
  tl.set({}, {}, 1); // length = 1 so positions == scroll fractions

  const camTo = (shot: { cam: number[]; look: number[] }, at: number, duration: number) =>
    tl.to(
      state,
      {
        camX: shot.cam[0], camY: shot.cam[1], camZ: shot.cam[2],
        lookX: shot.look[0], lookY: shot.look[1], lookZ: shot.look[2],
        ease: "power2.inOut", duration,
      },
      at,
    );

  // copy panels: in, then out (the last one stays until the finale)
  const panel = (el: HTMLElement, [a, b]: readonly [number, number]) => {
    tl.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, ease: "power2.out", duration: 0.04 }, a);
    tl.to(el, { autoAlpha: 0, y: -40, ease: "power1.in", duration: 0.035 }, b - 0.035);
  };
  const rail = (el: HTMLElement, [a, b]: readonly [number, number]) =>
    tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: b - a }, a);

  // ── title ──
  tl.to(overlay.title, { autoAlpha: 0, y: -50, ease: "power1.in", duration: span(P.title) }, P.title[0]);

  // ── step 1: post what you have ──
  panel(overlay.steps[0], P.step1);
  rail(overlay.rail[0], P.step1);
  tl.to(state, { phoneIn: 1, ease: "power3.out", duration: 0.1 }, 0.02);
  tl.to(state, { camZ: shots.step1.cam[2] - 0.9, ease: "power1.inOut", duration: 0.12 }, 0.08); // slow push-in
  tl.to(state, { flash: 1, duration: 0.006 }, P.flash).to(state, { flash: 0, ease: "power2.out", duration: 0.03 }, P.flash + 0.006);
  tl.to(state, { capture: 1, ease: "power2.in", duration: span(P.capture) }, P.capture[0]);
  tl.to(state, { screen: 1, duration: 0.001 }, P.capture[0] + 0.02);
  tl.to(state, { screen: 2, duration: 0.001 }, P.live);

  // ── phone becomes the seller pin on the map ──
  camTo(shots.step2, P.toMap[0], span(P.toMap) + 0.02);
  tl.to(state, { mapIn: 1, ease: "power3.out", duration: 0.09 }, P.toMap[0]);
  tl.to(state, { toMap: 1, ease: "power2.inOut", duration: span(P.toMap) }, P.toMap[0]);

  // ── step 2: get found on the map ──
  panel(overlay.steps[1], P.step2);
  rail(overlay.rail[1], P.step2);
  const rand = mulberry32(17);
  const order = pins.map((p) => ({ p, k: rand() })).sort((a, b) => a.k - b.k);
  order.forEach(({ p }, i) => {
    const at = P.pins[0] + (i / order.length) * span(P.pins);
    tl.to(p, { t: 1, ease: "bounce.out", duration: 0.035 }, at);
  });
  tl.to(state, { radar: 1, duration: 0.03 }, P.radar[0]);
  tl.to(state, { radar: 0, duration: 0.03 }, P.radar[1] - 0.01);
  tl.to(state, { lookX: shots.step2.look[0] - 0.25, camX: shots.step2.cam[0] - 0.25, ease: "sine.inOut", duration: 0.14 }, 0.49); // slow drift (must not overlap the camera moves either side)

  // ── step 3: hand it over ──
  panel(overlay.steps[2], P.step3);
  rail(overlay.rail[2], P.step3);
  camTo(shots.step3, P.step3[0] - 0.02, 0.08);
  tl.to(state, { collectorIn: 1, ease: "back.out(2)", duration: 0.03 }, P.route[0] - 0.02);
  tl.to(state, { route: 1, ease: "power1.inOut", duration: span(P.route) }, P.route[0]);
  tl.to(state, { bubble1: 1, ease: "back.out(2)", duration: 0.02 }, P.bubble1);
  tl.to(state, { bubble2: 1, ease: "back.out(2)", duration: 0.02 }, P.bubble2);
  tl.to(state, { done: 1, ease: "power2.out", duration: 0.05 }, P.done);

  // ── finale: zero landfill ──
  camTo(shots.finale, P.finale[0] - 0.02, 0.08);
  tl.to(state, { network: 1, ease: "none", duration: 0.09 }, P.finale[0]);
  tl.fromTo(overlay.finale, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, ease: "power2.out", duration: 0.05 }, P.finale[0] + 0.02);

  return () => {
    tl.scrollTrigger?.kill();
    tl.kill();
  };
}
