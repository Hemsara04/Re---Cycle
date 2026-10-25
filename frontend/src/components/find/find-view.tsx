"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ListIcon,
  LoaderCircleIcon,
  LocateFixedIcon,
  MapIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingDetailSheet } from "@/components/listings/listing-detail";
import { MaterialDot } from "@/components/listings/material-badge";
import { ListingsMap } from "@/components/map";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { PROVINCE_MAP, PROVINCES } from "@/lib/locations";
import { MATERIALS } from "@/lib/materials";
import { useDebounced } from "@/lib/use-debounced";
import { QUERY_KEYS, searchListings } from "@/lib/supabase/api";
import type { LatLng, Listing, ListingFilters, MaterialId, ProvinceId } from "@/lib/types";
import { cn } from "@/lib/utils";

const POSTED = [
  { value: "any", label: "Any time" },
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

export function FindView() {
  const params = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [province, setProvince] = useState(params.get("province") ?? "all");
  const [district, setDistrict] = useState("all");
  const [materials, setMaterials] = useState<MaterialId[]>(() => {
    const m = params.get("material");
    return m && MATERIALS.some((x) => x.id === m) ? [m as MaterialId] : [];
  });
  const [minQty, setMinQty] = useState(0);
  const [posted, setPosted] = useState("any");
  const [sort, setSort] = useState("newest");
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileView, setMobileView] = useState<"map" | "list">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Listing | null>(null);

  // Keep the shareable bits of the search in the URL
  useEffect(() => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (province !== "all") sp.set("province", province);
    if (materials.length === 1) sp.set("material", materials[0]);
    const qs = sp.toString();
    router.replace(qs ? `/find?${qs}` : "/find", { scroll: false });
  }, [query, province, materials, router]);

  // Debounce typing / slider drags so we don't hit the database on every keystroke
  const filters = useDebounced<ListingFilters>(
    useMemo(
      () => ({
        q: query,
        province: province === "all" ? null : (province as ProvinceId),
        district: district === "all" ? null : district,
        materials,
        minKg: minQty,
        sinceDays: posted === "any" ? null : Number(posted),
        near: me,
        radiusKm: me ? radius : null,
        sort: sort as ListingFilters["sort"],
      }),
      [query, province, district, materials, minQty, posted, me, radius, sort],
    ),
    250,
  );
  const search = useQuery({
    queryKey: QUERY_KEYS.search(filters),
    queryFn: () => searchListings(filters),
    placeholderData: keepPreviousData, // keep the old results on screen while new ones load
  });
  const results = useMemo(
    () => (search.data ?? []).map((l) => ({ listing: l, distance: l.distanceKm ?? undefined })),
    [search.data],
  );
  const ready = !search.isPending;

  const provinceBounds = province === "all" ? null : PROVINCE_MAP[province as keyof typeof PROVINCE_MAP].bounds;
  const activeFilterCount = (minQty > 0 ? 1 : 0) + (posted !== "any" ? 1 : 0) + (district !== "all" ? 1 : 0);

  function locate() {
    if (me) {
      setMe(null);
      if (sort === "nearest") setSort("newest");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Your browser doesn't support location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort("nearest");
        setProvince("all");
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location", { description: "Allow location access and try again." });
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const toggleMaterial = (id: MaterialId) =>
    setMaterials((ms) => (ms.includes(id) ? ms.filter((m) => m !== id) : [...ms, id]));

  const clearAll = () => {
    setQuery("");
    setProvince("all");
    setDistrict("all");
    setMaterials([]);
    setMinQty(0);
    setPosted("any");
  };

  const select = (id: string) => {
    setSelectedId(id);
    setDetail(results.find((r) => r.listing.id === id)?.listing ?? null);
  };

  return (
    <div className="flex h-[calc(100svh-4rem)] flex-col">
      {/* SEARCH BAR */}
      <div className="z-10 border-b bg-background">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search glass bottles, cardboard, copper wire…"
                className="h-10 pl-9"
                aria-label="Search listings"
              />
            </div>
            <div className="flex gap-2">
              <SimpleSelect
                aria-label="Province"
                className="h-10! flex-1 sm:w-48"
                value={province}
                onChange={(v) => {
                  setProvince(v);
                  setDistrict("all");
                  if (v !== "all") setMe(null);
                }}
                options={[{ value: "all", label: "All of Sri Lanka" }, ...PROVINCES.map((p) => ({ value: p.id, label: `${p.label} Province` }))]}
              />
              <Button
                variant={me ? "default" : "outline"}
                className="h-10"
                onClick={locate}
                disabled={locating}
                aria-pressed={!!me}
              >
                {locating ? <LoaderCircleIcon className="animate-spin" /> : me ? <XIcon /> : <LocateFixedIcon />}
                Near me
              </Button>
              <Button
                variant="outline"
                className="relative h-10"
                onClick={() => setShowFilters((s) => !s)}
                aria-expanded={showFilters}
              >
                <SlidersHorizontalIcon />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* material chips */}
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
            {MATERIALS.map((m) => {
              const on = materials.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMaterial(m.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                    on ? "border-transparent text-white" : "hover:bg-muted",
                  )}
                  style={on ? { backgroundColor: m.color } : undefined}
                >
                  {!on && <MaterialDot id={m.id} />}
                  {m.label}
                </button>
              );
            })}
          </div>

          {showFilters && (
            <div className="grid gap-4 rounded-xl border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label>District</Label>
                <SimpleSelect
                  className="w-full"
                  value={district}
                  onChange={setDistrict}
                  options={[
                    { value: "all", label: province === "all" ? "Pick a province first" : "All districts" },
                    ...(province === "all" ? [] : PROVINCE_MAP[province as keyof typeof PROVINCE_MAP].districts.map((d) => ({ value: d.name, label: d.name }))),
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Posted</Label>
                <SimpleSelect className="w-full" value={posted} onChange={setPosted} options={POSTED} />
              </div>
              <div className="space-y-1.5">
                <Label>Sort by</Label>
                <SimpleSelect
                  className="w-full"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "newest", label: "Newest first" },
                    { value: "quantity", label: "Largest quantity" },
                    ...(me ? [{ value: "nearest", label: "Nearest first" }] : []),
                  ]}
                />
              </div>
              <div className="space-y-3">
                <Label>Min quantity · {minQty} kg</Label>
                <Slider value={[minQty]} min={0} max={200} step={5} onValueChange={(v) => setMinQty(Array.isArray(v) ? v[0] : v)} />
              </div>
              <div className={cn("space-y-3", !me && "opacity-50")}>
                <Label>Distance · within {radius} km</Label>
                <Slider
                  disabled={!me}
                  value={[radius]}
                  min={2}
                  max={150}
                  step={1}
                  onValueChange={(v) => setRadius(Array.isArray(v) ? v[0] : v)}
                />
                {!me && <p className="text-xs text-muted-foreground">Turn on “Near me” to use distance.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RESULTS */}
      <div className="relative flex min-h-0 flex-1">
        <aside
          className={cn(
            "flex w-full flex-col border-r bg-background md:w-[420px] md:shrink-0",
            mobileView === "map" && "hidden md:flex",
          )}
        >
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {search.isError ? (
                <span className="text-destructive">Couldn&apos;t load listings. {search.error.message}</span>
              ) : ready ? (
                <>
                  <strong className="text-foreground">{results.length}</strong> listing{results.length === 1 ? "" : "s"}
                  {province !== "all" && ` in ${PROVINCE_MAP[province as keyof typeof PROVINCE_MAP].label}`}
                  {me && ` within ${radius} km`}
                  {search.isFetching && <LoaderCircleIcon className="ml-1.5 inline size-3.5 animate-spin" />}
                </>
              ) : (
                "Loading…"
              )}
            </span>
            {(query || province !== "all" || materials.length > 0 || activeFilterCount > 0) && (
              <button type="button" onClick={clearAll} className="text-xs font-medium text-primary hover:underline">
                Clear all
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-24 md:pb-4">
            {results.map(({ listing, distance }) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                distance={distance}
                active={listing.id === selectedId}
                onSelect={() => select(listing.id)}
              />
            ))}
            {ready && results.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Nothing matches yet</p>
                <p className="mt-1">Try a wider area, fewer materials, or check back tomorrow.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={clearAll}>
                  Reset filters
                </Button>
              </div>
            )}
          </div>
        </aside>

        <div className={cn("relative flex-1", mobileView === "list" && "hidden md:block")}>
          <ListingsMap
            listings={results.map((r) => r.listing)}
            selectedId={selectedId}
            onSelect={select}
            bounds={provinceBounds}
            userLocation={me}
            radiusKm={me ? radius : null}
          />
          <div className="pointer-events-none absolute bottom-6 left-3 z-[400] hidden flex-wrap gap-1.5 rounded-xl bg-background/90 p-2 text-xs shadow-sm backdrop-blur sm:flex">
            {MATERIALS.map((m) => (
              <span key={m.id} className="flex items-center gap-1">
                <MaterialDot id={m.id} /> {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* mobile map/list switch */}
        <div className="absolute bottom-5 left-1/2 z-[500] flex -translate-x-1/2 rounded-full border bg-background p-1 shadow-lg md:hidden">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setMobileView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium capitalize",
                mobileView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {v === "map" ? <MapIcon className="size-4" /> : <ListIcon className="size-4" />} {v}
            </button>
          ))}
        </div>
      </div>

      <ListingDetailSheet listing={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}
