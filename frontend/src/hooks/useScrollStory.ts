"use client";

import { type RefObject, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Hide the site nav while a pinned story section fills the screen.
 * Uses a counter so two adjacent sections can't switch each other's state off.
 */
export function useImmersiveNav(section: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !section.current) return;
    const root = document.documentElement;
    const set = (delta: number) => {
      const n = Math.max(0, Number(root.dataset.immersiveCount ?? 0) + delta);
      root.dataset.immersiveCount = String(n);
      root.toggleAttribute("data-immersive", n > 0);
    };
    let active = false;
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      onToggle: (self) => {
        if (self.isActive === active) return;
        active = self.isActive;
        set(active ? 1 : -1);
      },
    });
    return () => {
      st.kill();
      if (active) set(-1);
    };
  }, [section, enabled]);
}

/** True once the element is within one viewport of the screen (for lazy-loading 3D). */
export function useNearViewport(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, enabled]);
  return near;
}
