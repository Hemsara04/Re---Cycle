"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CameraIcon, MapPinnedIcon, MessageCircleIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { useImmersiveNav, useNearViewport } from "@/hooks/useScrollStory";
import { cn } from "@/lib/utils";
import { HOW_SCROLL_LENGTH_VH } from "./config";

const STEPS = [
  {
    icon: CameraIcon,
    title: "Post what you have",
    body: "Snap a photo, pick the material, add a rough weight and a pickup window. Drop a pin so collectors know where you are.",
  },
  {
    icon: MapPinnedIcon,
    title: "Get found on the map",
    body: "Collectors, recyclers and small businesses search by material and province — or just tap “near me”.",
  },
  {
    icon: MessageCircleIcon,
    title: "Hand it over",
    body: "They message you on WhatsApp with one tap, request the listing, and you accept. No middleman, no fee.",
  },
] as const;

// Desktop: copy alternates sides, opposite the 3D subject. Mobile: always at the bottom.
const STEP_SIDE = ["md:justify-start", "md:justify-end", "md:justify-start"];

export function HowItWorksStory() {
  const device = useDeviceTier();
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const steps = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const rail = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const finale = useRef<HTMLDivElement>(null);

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const measured = device.tier !== null;
  const animated = measured && device.webgl && !device.reducedMotion && !failed;

  useImmersiveNav(section, animated);
  const near = useNearViewport(section, animated);

  useEffect(() => {
    if (!near || !device.tier || !canvas.current || !section.current) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const [{ createHowScene }, { createHowTimeline }, { ScrollTrigger }] = await Promise.all([
          import("./index"),
          import("@/animation/howItWorksTimeline"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;
        const scene = await createHowScene({
          canvas: canvas.current!,
          tier: device.tier!,
          mobile: device.mobile,
          onProgress: (f) => !cancelled && setProgress(f),
        });
        if (cancelled) {
          scene.dispose();
          return;
        }
        const kill = createHowTimeline({
          trigger: section.current!,
          scene,
          overlay: {
            title: title.current!,
            steps: [steps[0].current!, steps[1].current!, steps[2].current!],
            rail: [rail[0].current!, rail[1].current!, rail[2].current!],
            finale: finale.current!,
          },
        });
        ScrollTrigger.refresh();
        cleanup = () => {
          kill();
          scene.dispose();
        };
        setReady(true);
      } catch (err) {
        console.error("HowItWorksStory: falling back to static cards", err);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // refs are stable; re-run only when the device classification changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, device.tier, device.mobile]);

  // Reduced motion, no WebGL, or a load failure: the plain three-card layout
  if (measured && !animated) return <StaticSteps />;

  return (
    <section
      ref={section}
      aria-labelledby="how-heading"
      className="relative bg-[#060908] text-white"
      style={{ height: `${HOW_SCROLL_LENGTH_VH}vh` }}
    >
      <div className="sr-only">
        <p>How it works</p>
        <h2 id="how-heading">Three steps, zero landfill</h2>
        <ol>
          {STEPS.map((s) => (
            <li key={s.title}>
              {s.title}. {s.body}
            </li>
          ))}
        </ol>
      </div>

      <div className="sticky top-0 h-svh overflow-hidden">
        <canvas ref={canvas} aria-hidden className={cn("absolute inset-0 size-full transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")} />

        {!ready && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[62%] mx-auto w-48 text-center">
            <div className="h-0.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}

        {/* scrims for legible copy */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#060908] via-[#060908]/50 to-transparent md:hidden" />
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 bg-gradient-to-r from-[#060908]/80 to-transparent md:block" />

        {/* title */}
        <div ref={title} aria-hidden className="absolute inset-0 grid place-items-center px-4 text-center">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-emerald-400 uppercase">How it works</p>
            <p className="mt-3 font-heading text-5xl font-extrabold sm:text-7xl">
              Three steps,
              <br />
              <span className="text-emerald-400">zero landfill.</span>
            </p>
          </div>
        </div>

        {/* step copy */}
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            ref={steps[i]}
            aria-hidden
            className={cn(
              "invisible absolute inset-x-0 bottom-0 flex px-4 pb-14 opacity-0 md:inset-y-0 md:items-center md:px-0 md:pb-0",
              STEP_SIDE[i],
            )}
          >
            <div className="w-full max-w-md md:mx-[7vw]">
              <div className="flex items-center gap-3">
                <span className="font-heading text-6xl leading-none font-extrabold text-emerald-400/90 tabular-nums sm:text-7xl">
                  0{i + 1}
                </span>
                <span className="grid size-11 place-items-center rounded-xl bg-white/10 backdrop-blur">
                  <s.icon className="size-5 text-emerald-300" />
                </span>
              </div>
              <p className="mt-4 font-heading text-3xl font-bold sm:text-4xl">{s.title}</p>
              <p className="mt-3 text-white/70 sm:text-lg">{s.body}</p>
            </div>
          </div>
        ))}

        {/* progress rail (top; the nav is hidden while this section is pinned) */}
        <div aria-hidden className="absolute inset-x-0 top-5 flex justify-center gap-2 px-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="w-16 sm:w-28">
              <div className="h-0.5 overflow-hidden rounded-full bg-white/15">
                <div ref={rail[i]} className="h-full w-full origin-left scale-x-0 bg-emerald-400" />
              </div>
              <p className="mt-2 hidden text-center text-[11px] tracking-wide whitespace-nowrap text-white/40 sm:block">{s.title}</p>
            </div>
          ))}
        </div>

        {/* finale */}
        <div
          ref={finale}
          className="invisible absolute inset-x-0 bottom-0 flex px-4 pb-14 opacity-0 md:inset-y-0 md:items-center md:px-0 md:pb-0"
        >
          <div className="w-full max-w-md space-y-5 md:mx-[7vw]">
            <p aria-hidden className="font-heading text-5xl leading-[1.02] font-extrabold sm:text-6xl">
              Zero <span className="text-emerald-400">landfill.</span>
            </p>
            <p aria-hidden className="text-white/70 sm:text-lg">
              Every listing that gets picked up is one less pile burned, buried or dumped in a canal.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/post" className={cn(buttonVariants({ size: "lg" }), "h-12 bg-emerald-400 px-6 text-base text-emerald-950 hover:bg-emerald-300")}>
                Post your waste <ArrowRightIcon />
              </Link>
              <Link href="/find" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 px-5 text-base text-white hover:bg-white/10 hover:text-white")}>
                Find materials
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StaticSteps() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">How it works</p>
        <h2 id="how-heading" className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Three steps, zero landfill</h2>
      </div>
      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative rounded-3xl border bg-card p-6">
            <span className="absolute top-5 right-6 font-heading text-6xl font-extrabold text-muted/80 select-none dark:text-muted">
              {i + 1}
            </span>
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <s.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
