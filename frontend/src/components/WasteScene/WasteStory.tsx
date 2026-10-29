"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { useImmersiveNav, useNearViewport } from "@/hooks/useScrollStory";
import { isLoaderClosed, useLoaderTask } from "@/lib/page-loader";
import { cn } from "@/lib/utils";
import { CAMERA, SCROLL_LENGTH_VH } from "./config";

gsap.registerPlugin(ScrollTrigger);

const FALLBACK_IMAGE = "/images/waste-globe.svg";

const COPY = {
  eyebrow: "The problem",
  heading: "“Sorry, we don’t take that.”",
  body: "Across Sri Lanka, many municipal waste trucks refuse plastic, glass and electronic items. So it piles up in back gardens, gets burned, or ends up in canals — while collectors and recyclers are looking for exactly these materials.",
  caption: "Bottles. Cans. Cardboard. Circuit boards.",
  captionSub: "Piece by piece, every bit finds someone who can use it.",
  headline: "Waste is just value in the wrong place.",
  sub: "Re-සයිකල් LK puts it in the right one — for free, over WhatsApp.",
};

export function WasteStory() {
  const device = useDeviceTier();
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const finale = useRef<HTMLDivElement>(null);

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const measured = device.tier !== null;
  const still = device.reducedMotion;
  const showFallback = measured && (!device.webgl || failed);
  const animated = measured && !still && !showFallback;

  // The nav hides while pinned. On the first page load the scene builds behind the
  // loading screen; after that (client-side navigation) it loads when about to scroll in.
  useImmersiveNav(section, animated);
  const [preload] = useState(() => typeof window !== "undefined" && !isLoaderClosed());
  const near = useNearViewport(section, measured && !showFallback) || (preload && measured && !showFallback);
  const reportLoad = useLoaderTask(!(ready || failed || (measured && showFallback)));

  useEffect(() => {
    if (!near || !device.tier || !canvas.current || !section.current) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        performance.mark("waste-scene:start");
        const [{ createWasteScene }, timeline] = await Promise.all([
          import("./index"),
          import("@/animation/timeline"),
        ]);
        if (cancelled) return;
        const scene = await createWasteScene({
          canvas: canvas.current!,
          tier: device.tier!,
          mobile: device.mobile,
          still,
          onProgress: (f) => {
            if (cancelled) return;
            setProgress(f);
            reportLoad(f);
          },
        });
        if (cancelled) {
          scene.dispose();
          return;
        }

        if (still) {
          // Reduced motion: no scroll story, just the finished globe.
          const kill = timeline.applyFinalFrame({
            scene,
            overlay: { intro: document.createElement("div"), caption: document.createElement("div"), finale: finale.current! },
            mobile: device.mobile,
          });
          // centred framing for the still (the scroll version slides the globe aside)
          Object.assign(scene.state, { shiftX: 0, shiftY: 0, camZ: CAMERA.assembled.z + 1.5 });
          scene.renderOnce();
          const onResize = () => requestAnimationFrame(scene.renderOnce);
          window.addEventListener("resize", onResize);
          cleanup = () => {
            window.removeEventListener("resize", onResize);
            kill();
            scene.dispose();
          };
        } else {
          const kill = timeline.createMasterTimeline({
            trigger: section.current!,
            scene,
            overlay: { intro: intro.current!, caption: caption.current!, finale: finale.current! },
            mobile: device.mobile,
          });
          ScrollTrigger.refresh();
          cleanup = () => {
            kill();
            scene.dispose();
          };
        }
        // visible in DevTools → Performance, handy when tuning load time
        performance.measure("waste-scene:ready", "waste-scene:start");
        setReady(true);
      } catch (err) {
        console.error("WasteStory: falling back to static image", err);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [near, device.tier, device.mobile, still, reportLoad]);

  // Reduced motion / no WebGL: a normal, non-pinned section
  if (measured && (still || showFallback)) {
    return (
      <section ref={section} aria-labelledby="problem-heading" className="relative overflow-hidden bg-[#060908] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div className="space-y-4">
            <p className="text-sm font-semibold tracking-wide text-emerald-400 uppercase">{COPY.eyebrow}</p>
            <h2 id="problem-heading" className="font-heading text-3xl font-bold sm:text-4xl">{COPY.heading}</h2>
            <p className="text-white/70">{COPY.body}</p>
          </div>
          <div className="relative aspect-square w-full">
            {showFallback ? (
              // eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed
              <img src={FALLBACK_IMAGE} alt="A globe made of plastic bottles, cans, cardboard and circuit boards" className="size-full object-contain" />
            ) : (
              <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full" />
            )}
          </div>
        </div>
        <div ref={finale} className="mx-auto max-w-6xl px-4 pb-24">
          <FinaleCopy visibleToScreenReaders />
        </div>
      </section>
    );
  }


  return (
    <section
      ref={section}
      aria-labelledby="problem-heading"
      className="relative bg-[#060908] text-white"
      style={{ height: `${SCROLL_LENGTH_VH}vh` }}
    >
      {/* Screen readers get the whole story as plain text */}
      <div className="sr-only">
        <p>{COPY.eyebrow}</p>
        <h2 id="problem-heading">{COPY.heading}</h2>
        <p>{COPY.body}</p>
        <p>{COPY.caption} {COPY.captionSub}</p>
        <p>{COPY.headline} {COPY.sub}</p>
      </div>

      {/* CSS sticky does the pinning (avoids GSAP pin-spacers fighting React's DOM) */}
      <div className="sticky top-0 h-svh overflow-hidden">
        <canvas ref={canvas} aria-hidden className={cn("absolute inset-0 size-full transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")} />

        {/* loading screen */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-700",
            ready ? "opacity-0" : "opacity-100",
          )}
        >
          <div className="w-48 text-center">
            <div className="h-0.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-3 text-xs tracking-widest text-white/40 uppercase tabular-nums">
              Collecting waste · {Math.round(progress * 100)}%
            </p>
          </div>
        </div>

        {/* bottom scrim keeps overlay copy readable over bright pieces */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#060908] via-[#060908]/60 to-transparent" />

        {/* 1. problem copy */}
        <div ref={intro} aria-hidden className="absolute inset-x-0 bottom-0 px-4 pb-16 sm:pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-xl space-y-4">
              <p className="text-sm font-semibold tracking-wide text-emerald-400 uppercase">{COPY.eyebrow}</p>
              <p className="font-heading text-4xl font-bold sm:text-5xl">{COPY.heading}</p>
              <p className="text-white/70 sm:text-lg">{COPY.body}</p>
              <p className="flex items-center gap-2 pt-2 text-xs tracking-widest text-white/40 uppercase">
                <span className="inline-block h-6 w-px animate-pulse bg-white/40" /> Scroll
              </p>
            </div>
          </div>
        </div>

        {/* 2. mid-assembly caption */}
        <div ref={caption} aria-hidden className="invisible absolute inset-x-0 bottom-0 px-4 pb-14 text-center opacity-0">
          <p className="font-heading text-2xl font-semibold sm:text-3xl">{COPY.caption}</p>
          <p className="mt-2 text-white/60">{COPY.captionSub}</p>
        </div>

        {/* 3. finale */}
        <div
          ref={finale}
          className="invisible absolute inset-x-0 bottom-0 px-4 pb-14 opacity-0 md:inset-y-0 md:flex md:items-center md:pb-0"
        >
          <div className="mx-auto w-full max-w-6xl">
            <FinaleCopy visibleToScreenReaders={false} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** In the scroll version the sr-only block already reads this copy, so only the links stay exposed. */
function FinaleCopy({ visibleToScreenReaders }: { visibleToScreenReaders: boolean }) {
  const hide = !visibleToScreenReaders || undefined;
  return (
    <div className="max-w-md space-y-5">
      <p aria-hidden={hide} className="font-heading text-4xl leading-[1.02] font-extrabold sm:text-6xl">
        Waste is just value in the <span className="text-emerald-400">wrong place.</span>
      </p>
      <p aria-hidden={hide} className="text-white/70 sm:text-lg">{COPY.sub}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-12 bg-emerald-400 px-6 text-base text-emerald-950 hover:bg-emerald-300")}>
          Get started <ArrowRightIcon />
        </Link>
        <Link href="/find" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 px-5 text-base text-white hover:bg-white/10 hover:text-white")}>
          Browse the map
        </Link>
      </div>
    </div>
  );
}
