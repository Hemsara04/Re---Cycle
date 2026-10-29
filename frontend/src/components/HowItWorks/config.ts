/**
 * Knobs for the "How it works" scroll story. Positions are fractions (0–1) of
 * the section's scroll distance. Rendering settings (tiers, lights, post) are
 * shared with the waste scene — see components/WasteScene/config.ts.
 */
import type { Tier } from "@/components/WasteScene/config";

export const HOW_SCROLL_LENGTH_VH = 500;

export const HOW_PHASES = {
  title: [0, 0.07], // "Three steps, zero landfill" fades out
  step1: [0.06, 0.34], // phone, flash, capture, listing goes live
  flash: 0.2,
  capture: [0.21, 0.29],
  live: 0.3, // screen switches to "listing is live"
  toMap: [0.34, 0.46], // phone flies down and becomes a pin on the map
  step2: [0.44, 0.66], // pins drop, radar pulse
  pins: [0.44, 0.58],
  radar: [0.5, 0.66],
  step3: [0.66, 0.9], // collector route, chat, pickup
  route: [0.68, 0.8],
  bubble1: 0.72,
  bubble2: 0.77,
  done: 0.8,
  finale: [0.9, 1.0], // pull back, network of handovers, CTA
} as const;

export const PIN_COUNTS: Record<Tier, number> = { high: 46, medium: 36, low: 26 };
export const NETWORK_ROUTES = 6; // extra handovers that light up in the finale

/** Map projection: degrees → world units, centred on Sri Lanka. North is −Z. */
export const MAP = { centerLng: 80.7, centerLat: 7.85, scale: 1.55, thickness: 0.22 };

export const SELLER = { name: "Colombo", lng: 79.8612, lat: 6.9271 };
export const COLLECTOR = { name: "Kandy", lng: 80.6337, lat: 7.2906 };

export const HOW_COLORS = {
  land: "#1d4630",
  landEdge: "#3ddc84",
  ocean: "#0b1712",
  seller: "#3ddc84",
  collector: "#2f80ed",
  route: "#5ef0a0",
  phone: "#1b1e1d",
  whatsapp: "#25d366",
};

type V3 = [number, number, number];
type Shot = { cam: V3; look: V3 };

/**
 * Camera framing per beat. Desktop shots push the subject to the side opposite
 * the copy panel; mobile keeps it centred above the copy at the bottom.
 */
export const SHOTS: Record<"desktop" | "mobile", Record<"step1" | "step2" | "step3" | "finale", Shot>> = {
  desktop: {
    step1: { cam: [-1.2, 0.5, 9.6], look: [-1.2, -0.1, 0] },
    step2: { cam: [2.5, 11.2, 7.7], look: [2.5, 0, 0.6] },
    step3: { cam: [-1.9, 5.4, 6.6], look: [-1.9, 0, 1.0] },
    finale: { cam: [-2.6, 11.4, 7.6], look: [-2.6, 0, 0.3] },
  },
  mobile: {
    step1: { cam: [0, -0.2, 12.2], look: [0, -1.0, 0] },
    step2: { cam: [0, 13.5, 7.6], look: [0, 0, 1.9] },
    step3: { cam: [-1.4, 7.6, 7.4], look: [-1.4, 0, 2.3] },
    finale: { cam: [0, 14.5, 8.2], look: [0, 0, 2.1] },
  },
};

/** iPhone 17 Pro glTF (see CREDITS.md). If it fails to load, a procedural stand-in is used. */
export const PHONE_MODEL_URL = "/models/iphone_17_pro.glb";
/** The model ships in Cosmic Orange, which blooms into a glowing outline under the rim light; Deep Blue reads cleanly. */
export const PHONE_FINISH = "#27334a";

export const PHONE_POSE = { position: [1.1, 0, 1.2] as V3, rotationY: -0.38 };
export const SUBJECT_POSE = { position: [-0.55, -0.9, -1.6] as V3 };
export const MOBILE_PHONE_POSE = { position: [0.35, 0.9, 0.6] as V3, rotationY: -0.2 };
export const MOBILE_SUBJECT_POSE = { position: [-0.55, -1.95, 1.6] as V3 }; // in front of and below the phone
