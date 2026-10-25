"use client";

import { useEffect, useState } from "react";
import type { Tier } from "@/components/WasteScene/config";

export type DeviceInfo = {
  /** null until measured on the client */
  tier: Tier | null;
  webgl: boolean;
  reducedMotion: boolean;
  mobile: boolean;
};

// Software renderers and very old mobile GPUs: always treat as low tier.
const WEAK_GPU = /swiftshader|llvmpipe|softpipe|mali-[4t]\d{2}\b|adreno \(tm\) [3-5]\d{2}|powervr|intel\(r\) hd graphics [2-5]\d{2,3}/i;

export function detectDevice(): Omit<DeviceInfo, "tier"> & { tier: Tier } {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;

  let webgl = false;
  let gpu = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (gl) {
      webgl = true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl = false;
  }

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  const saveData = nav.connection?.saveData === true;

  let tier: Tier = "high";
  if (!webgl || WEAK_GPU.test(gpu) || saveData || cores <= 2 || memory <= 2) tier = "low";
  else if (mobile || cores <= 4 || memory <= 4) tier = mobile && (cores <= 6 || memory <= 4) ? "low" : "medium";

  return { tier, webgl, reducedMotion, mobile };
}

/** Classifies the device once on mount so the scene can scale its cost. */
export function useDeviceTier(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>({ tier: null, webgl: true, reducedMotion: false, mobile: false });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- needs browser APIs, runs once
    setInfo(detectDevice());
  }, []);
  return info;
}
