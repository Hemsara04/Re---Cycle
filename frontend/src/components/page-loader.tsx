"use client";

import { useEffect, useRef, useState } from "react";
import { closeLoader, loaderStatus, subscribeLoader } from "@/lib/page-loader";
import { cn } from "@/lib/utils";

const MIN_MS = 900; // long enough for the logo to draw itself, short enough not to annoy
const MAX_MS = 12_000; // never hold the page hostage on a slow GPU or network
const EXIT_MS = 700;

/** Fired on window once the loader has lifted; smooth scroll and ScrollTrigger wait for it. */
export const PAGE_READY_EVENT = "page-ready";

declare global {
  interface Window {
    __pageReady?: boolean;
  }
}

/**
 * Full-screen brand loader shown on the first (hard) page load only. It is part of the
 * server-rendered HTML, so it covers the page before any JS runs, and lifts once the
 * document, fonts and every registered loader task (the 3D scenes) are ready.
 */
export function PageLoader() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "exiting" | "gone">("loading");
  const bar = useRef(0);

  useEffect(() => {
    const start = performance.now();
    let finished = false;
    let unsub = () => {};
    let cap = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      unsub();
      clearTimeout(cap);
      setProgress(1);
      const wait = Math.max(0, MIN_MS - (performance.now() - start));
      setTimeout(() => {
        closeLoader();
        document.documentElement.classList.remove("is-loading");
        window.__pageReady = true;
        window.dispatchEvent(new Event(PAGE_READY_EVENT));
        setPhase("exiting");
        setTimeout(() => setPhase("gone"), EXIT_MS);
      }, wait);
    };

    const check = () => {
      const s = loaderStatus();
      // never let the bar go backwards when a new task registers
      bar.current = Math.max(bar.current, s.progress * 0.95);
      setProgress(bar.current);
      if (s.done) finish();
    };

    const documentReady = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    });
    // two frames so components that register on mount (after a re-render) are counted
    const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    cap = window.setTimeout(finish, MAX_MS);
    Promise.all([documentReady, document.fonts?.ready]).then(frames).then(() => {
      if (finished) return;
      unsub = subscribeLoader(check);
      check();
    });

    return () => {
      unsub();
      clearTimeout(cap);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Re-සයිකල් LK"
      className={cn("page-loader fixed inset-0 z-[100] grid place-items-center bg-background", phase === "exiting" && "is-exiting")}
    >
      <div className="page-loader-inner flex flex-col items-center gap-6">
        <svg viewBox="0 0 32 32" aria-hidden className="page-loader-mark size-20 drop-shadow-[0_12px_32px_rgb(61_220_132/0.25)]">
          <rect width="32" height="32" rx="9" className="fill-primary" />
          <g fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-foreground">
            <path pathLength={1} d="M11 20.5 8.2 15.6a2 2 0 0 1 0-2l3.3-5.7a2 2 0 0 1 3.4 0l1.4 2.4" />
            <path pathLength={1} d="m19.6 10.6 4.3 7.4a2 2 0 0 1-1.7 3H18" />
            <path pathLength={1} d="M14.3 21H9.8" />
            <path pathLength={1} d="m17.4 8.4-.6 2.6-2.6-.6M21 23l-3-2 2-2.8M11.6 18.6 11 21l2.6.7" />
          </g>
        </svg>
        <p className="font-heading text-2xl leading-none font-bold tracking-tight">
          Re-<span className="text-primary">සයිකල්</span>
          <span className="ml-1.5 rounded-md bg-foreground px-1.5 py-0.5 align-middle text-xs font-semibold text-background">LK</span>
        </p>
        <div aria-hidden className="h-0.5 w-40 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${Math.max(0.04, progress)})` }}
          />
        </div>
      </div>
    </div>
  );
}
