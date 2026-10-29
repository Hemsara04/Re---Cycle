"use client";

import "lenis/dist/lenis.css";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { PAGE_READY_EVENT } from "@/components/page-loader";

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

/**
 * Site-wide inertial scrolling (Lenis), driven by GSAP's ticker so ScrollTrigger
 * scenes update on exactly the same frame as the scroll position.
 *
 * Wheel and trackpad get the eased, weighted glide; touch keeps the platform's
 * native momentum (already smooth on iOS/Android, and faking it feels wrong).
 * Maps and nested scrollers (sheets, dialogs, menus) scroll natively.
 */
export function SmoothScroll() {
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const instance = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo out: quick response, long soft tail
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1,
      syncTouch: false,
      anchors: { offset: -72 }, // clear the sticky header
      allowNestedScroll: true,
      autoRaf: false,
      prevent: (node) => node.classList?.contains("leaflet-container") ?? false,
    });
    lenis = instance;
    instance.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // hold still under the loading screen, then refresh trigger positions once the page is final
    const start = () => {
      instance.start();
      instance.resize();
      ScrollTrigger.refresh();
    };
    if (window.__pageReady) start();
    else {
      instance.stop();
      window.addEventListener(PAGE_READY_EVENT, start, { once: true });
    }

    return () => {
      window.removeEventListener(PAGE_READY_EVENT, start);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      instance.destroy();
      lenis = null;
    };
  }, []);

  // new route: jump to the top without gliding through the old page, and re-measure
  useEffect(() => {
    if (!lenis || pathname === firstPath.current) return;
    firstPath.current = "";
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.resize();
  }, [pathname]);

  return null;
}
