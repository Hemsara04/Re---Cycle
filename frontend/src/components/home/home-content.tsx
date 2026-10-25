"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRightIcon,
  Building2Icon,
  FactoryIcon,
  HomeIcon,
  TruckIcon,
} from "lucide-react";
import { HeroScene } from "@/components/home/hero-scene";
import { HowItWorksStory } from "@/components/HowItWorks/HowItWorksStory";
import { WasteStory } from "@/components/WasteScene/WasteStory";
import { MATERIAL_ICONS } from "@/components/listings/material-badge";
import { buttonVariants } from "@/components/ui/button";
import { MATERIALS } from "@/lib/materials";
import { searchListings } from "@/lib/supabase/api";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const ROLES = [
  { icon: HomeIcon, title: "Households", role: "Seller", body: "Clear out bottles, cardboard and old chargers the garbage truck leaves behind." },
  { icon: TruckIcon, title: "Collectors", role: "Collector", body: "Plan a route through listings near you and fill the three-wheeler in one trip." },
  { icon: Building2Icon, title: "Businesses", role: "Business", body: "Shops, hotels and offices can post bulk waste or source packaging cheaply." },
  { icon: FactoryIcon, title: "Recyclers", role: "Recycler", body: "Find steady supply of sorted plastic, glass, metal and e-waste across the island." },
];

export function HomeContent() {
  const root = useRef<HTMLDivElement>(null);
  // Live numbers for the hero: every available listing (search_listings only returns available ones)
  const live = useQuery({ queryKey: ["listings", "search", { limit: 500 }], queryFn: () => searchListings({ limit: 500 }) });
  const ready = live.isSuccess;

  const stats = useMemo(() => {
    const available = live.data ?? [];
    const byMaterial = Object.fromEntries(MATERIALS.map((m) => [m.id, 0])) as Record<string, number>;
    for (const l of available) byMaterial[l.material] += 1;
    return {
      live: available.length,
      kg: Math.round(available.reduce((s, l) => s + l.quantityKg, 0)),
      districts: new Set(available.map((l) => l.district)).size,
      byMaterial,
    };
  }, [live.data]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-hero-line]", { y: 40, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 });
      gsap.from("[data-hero-fade]", { opacity: 0, y: 16, duration: 0.8, delay: 0.5, stagger: 0.08 });

      gsap.to("[data-hero-cover]", {
        opacity: 1,
        ease: "none",
        scrollTrigger: { trigger: "[data-hero]", start: "bottom 98%", end: "bottom 62%", scrub: true },
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el.children, {
          y: 36,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: "top 82%" },
        });
      });

    }, root);
    return () => ctx.revert();
  }, []);

  // Count-up once the store has loaded real numbers
  useEffect(() => {
    if (!ready) return;
    const els = root.current?.querySelectorAll<HTMLElement>("[data-count]");
    els?.forEach((el) => {
      const target = Number(el.dataset.count);
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.4,
        ease: "power2.out",
        onUpdate: () => (el.textContent = Math.round(obj.v).toLocaleString()),
      });
    });
  }, [ready, stats]);

  return (
    <div ref={root} className="overflow-x-clip">
      {/* HERO */}
      <section data-hero className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-secondary),transparent_65%)]" />
        <HeroScene className="absolute inset-0 -z-10 opacity-90 [mask-image:radial-gradient(ellipse_at_center,transparent_18%,black_60%)]" />
        <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-4xl flex-col items-center justify-center px-4 py-20 text-center">
          <span
            data-hero-fade
            className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            {ready ? `${stats.live} listings live across Sri Lanka` : "Live across Sri Lanka"}
          </span>
          <h1 className="font-heading text-5xl leading-[0.95] font-extrabold sm:text-7xl">
            <span data-hero-line className="block">Your waste is</span>
            <span data-hero-line className="block">
              someone&apos;s <span className="text-primary">raw material.</span>
            </span>
          </h1>
          <p data-hero-line className="mt-4 font-heading text-xl text-muted-foreground" lang="si">
  
          </p>
          <p data-hero-fade className="mt-6 max-w-xl text-balance text-muted-foreground sm:text-lg">
            The garbage truck won&apos;t take your bottles, plastic or old electronics? Post them here and let a
            collector or recycler nearby pick them up — for free, over WhatsApp.
          </p>
          <div data-hero-fade className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/find" className={cn(buttonVariants({ size: "lg" }), "h-12 px-5 text-base")}>
              Find materials <ArrowRightIcon />
            </Link>
            <Link
              href="/post"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 bg-background/70 px-5 text-base backdrop-blur")}
            >
              Post your waste
            </Link>
          </div>

          <dl data-hero-fade className="mt-14 grid w-full max-w-lg grid-cols-3 divide-x rounded-2xl border bg-background/70 py-4 backdrop-blur">
            {[
              { label: "kg available", value: stats.kg },
              { label: "open listings", value: stats.live },
              { label: "districts", value: stats.districts },
            ].map((s) => (
              <div key={s.label} className="px-2">
                <dd className="font-heading text-2xl font-bold tabular-nums sm:text-3xl" data-count={s.value}>
                  0
                </dd>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
        {/* Fades the hero to the studio black as the 3D story scrolls in, so the two scenes never mix */}
        <div data-hero-cover aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-[#060908] opacity-0" />
      </section>

      {/* PROBLEM → scroll-driven 3D story */}
      <WasteStory />

      {/* HOW IT WORKS → scroll-driven 3D story */}
      <HowItWorksStory />

      {/* MATERIALS */}
      <section className="bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-wide text-primary uppercase">What&apos;s on the map</p>
              <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Every material has a colour</h2>
            </div>
            <Link href="/find" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
              Open the map <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <div data-reveal className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {MATERIALS.map((m) => {
              const Icon = MATERIAL_ICONS[m.id];
              return (
                <Link
                  key={m.id}
                  href={`/find?material=${m.id}`}
                  className="group rounded-2xl border border-background/10 bg-background/5 p-5 transition-colors hover:bg-background/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-full" style={{ background: m.color }}>
                      <Icon className="size-5 text-white" />
                    </span>
                    <span className="text-sm tabular-nums opacity-70">
                      {stats.byMaterial[m.id] ?? 0} live
                    </span>
                  </div>
                  <div className="mt-4 font-semibold">{m.label}</div>
                  <div className="text-sm opacity-60" lang="si">{m.sinhala}</div>
                  <div className="mt-2 text-xs opacity-60">{m.examples}</div>
                </Link>
              );
            })}
            <Link
              href="/post"
              className="flex flex-col justify-between rounded-2xl bg-primary p-5 text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              <span className="text-sm opacity-80">Got something else?</span>
              <span className="mt-6 flex items-center gap-1 font-semibold">
                Post it anyway <ArrowRightIcon className="size-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <div data-reveal className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Who it&apos;s for</p>
          <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">One exchange, four kinds of people</h2>
        </div>
        <div data-reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.title} className="rounded-3xl border bg-card p-6">
              <r.icon className="size-6 text-primary" />
              <h3 className="mt-4 font-semibold">{r.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              <span className="mt-4 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                Sign up as {r.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div
          data-reveal
          className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-[2rem] bg-primary p-8 text-primary-foreground sm:p-12 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">Clear the corner of your garage.</h2>
            <p className="mt-2 opacity-80">It takes about a minute to post a listing.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/post" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-12 px-5")}>
              Post your waste
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 px-5 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground")}
            >
              Create account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
