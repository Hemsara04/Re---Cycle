"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlusIcon, LoaderCircleIcon, LocateFixedIcon, MapPinIcon, XIcon } from "lucide-react";
import { MATERIAL_ICONS } from "@/components/listings/material-badge";
import { LocationPicker } from "@/components/map";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/image";
import { locate, PROVINCE_MAP } from "@/lib/locations";
import { MATERIALS } from "@/lib/materials";
import { useAuth } from "@/lib/auth";
import { createListing } from "@/lib/supabase/api";
import type { LatLng, MaterialId } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 4;
const today = () => new Date().toISOString().slice(0, 10);

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b py-8 last:border-0 md:grid-cols-[220px_1fr]">
      <div>
        <span className="font-heading text-sm font-bold text-primary">0{n}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function PostForm() {
  const router = useRouter();
  const { user: currentUser, ready } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [materialId, setMaterialId] = useState<MaterialId | null>(null);
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("");
  const [description, setDescription] = useState("");
  // compressed JPEGs + object-URL previews; uploaded to Storage on publish
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [busyPhotos, setBusyPhotos] = useState(false);
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // free the preview object URLs when leaving the page
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const publish = useMutation({
    mutationFn: (args: Parameters<typeof createListing>) => createListing(...args),
    onSuccess: async (_id, [, input]) => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Your listing is live!", { description: `${input.title} · ${input.district}` });
      router.push("/dashboard");
    },
    onError: (e: Error) => toast.error("Couldn't publish", { description: e.message }),
  });

  if (!ready) return <div className="h-96 animate-pulse rounded-3xl bg-muted" />;

  if (!currentUser) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Sign in to post</CardTitle>
          <CardDescription>
            We need a name and phone number so collectors can reach you on WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          <Link href="/login?next=/post" className={buttonVariants({ size: "lg" })}>Sign in</Link>
          <Link href="/signup?next=/post" className={buttonVariants({ variant: "outline", size: "lg" })}>Create account</Link>
        </CardContent>
      </Card>
    );
  }

  if (!currentUser.approved) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Waiting for approval</CardTitle>
          <CardDescription>
            <span className="capitalize">{currentUser.role}</span> accounts are checked by an admin before they can post.
            You&apos;ll be able to publish listings as soon as you&apos;re approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/find" className={buttonVariants({ variant: "outline", size: "lg" })}>Browse listings meanwhile</Link>
        </CardContent>
      </Card>
    );
  }

  const place = pin ? locate(pin) : null;
  const errors = {
    material: !materialId && "Pick a material",
    title: !title.trim() && "Give it a short title",
    qty: !(Number(qty) > 0) && "Enter an approximate weight",
    window: from >= to && "End time must be after start time",
    pin: !pin && "Drop a pin on the map",
    phone: !currentUser.phone && "Add a WhatsApp number in your dashboard (Profile tab) so people can contact you",
  };
  const firstError = Object.values(errors).find(Boolean);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setBusyPhotos(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const blobs = await Promise.all(Array.from(files).slice(0, room).map((f) => compressImage(f)));
      setPhotos((p) => [...p, ...blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))]);
    } catch {
      toast.error("Couldn't read that image");
    } finally {
      setBusyPhotos(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function locateMe() {
    if (!navigator.geolocation) return toast.error("Your browser doesn't support location");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPin({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location — tap the map instead");
      },
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (firstError || !materialId || !pin || !place) {
      toast.error(firstError || "Check the form");
      return;
    }
    publish.mutate([
      currentUser!.id,
      {
        title: title.trim(),
        material: materialId,
        quantityKg: Number(qty),
        description: description.trim(),
        pickup: { date, from, to },
        location: pin,
        province: place.province,
        district: place.district,
      },
      photos.map((p) => p.blob),
    ]);
  }

  const err = (k: keyof typeof errors) =>
    submitted && errors[k] ? <p className="text-sm text-destructive">{errors[k]}</p> : null;

  return (
    <form onSubmit={submit} noValidate>
      <Section n={1} title="What is it?" hint="Pick the closest match — it sets the pin colour on the map.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MATERIALS.map((m) => {
            const Icon = MATERIAL_ICONS[m.id];
            const on = materialId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMaterialId(m.id)}
                aria-pressed={on}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all",
                  on ? "border-transparent ring-2" : "hover:bg-muted",
                )}
                style={on ? { background: `${m.color}18`, ["--tw-ring-color" as string]: m.color } : undefined}
              >
                <span className="grid size-8 place-items-center rounded-lg text-white" style={{ background: m.color }}>
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium leading-tight">{m.label}</span>
              </button>
            );
          })}
        </div>
        {err("material")}
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={materialId ? `e.g. ${MATERIALS.find((m) => m.id === materialId)!.examples.split(",")[0]}` : "e.g. Glass bottles"}
              maxLength={80}
              className="h-10"
            />
            {err("title")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity (kg)</Label>
            <Input
              id="qty"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="25"
              className="h-10"
            />
            {err("qty")}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Condition, whether it's sorted/cleaned, access for vehicles, anything a collector should know."
          />
        </div>
      </Section>

      <Section n={2} title="Photos" hint={`Up to ${MAX_PHOTOS}. Listings with photos get claimed faster.`}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => {
                  URL.revokeObjectURL(p.url);
                  setPhotos((ps) => ps.filter((_, j) => j !== i));
                }}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              {busyPhotos ? <LoaderCircleIcon className="animate-spin" /> : <ImagePlusIcon />}
              Add photo
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          hidden
          onChange={(e) => addPhotos(e.target.files)}
        />
      </Section>

      <Section n={3} title="Pickup window" hint="When can someone come and collect it?">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
          </div>
        </div>
        {err("window")}
      </Section>

      <Section n={4} title="Pickup location" hint="Tap the map to drop a pin, then drag it to adjust.">
        <div className="relative h-80 overflow-hidden rounded-2xl border">
          <LocationPicker value={pin} onChange={setPin} materialId={materialId ?? "plastic"} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={locateMe}
            disabled={locating}
            className="absolute top-3 right-3 z-[400] shadow"
          >
            {locating ? <LoaderCircleIcon className="animate-spin" /> : <LocateFixedIcon />} Use my location
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPinIcon className="size-4" />
          {place ? (
            <>
              Near <strong className="text-foreground">{place.district}</strong>, {PROVINCE_MAP[place.province].label} Province
            </>
          ) : (
            "No pin yet"
          )}
        </p>
        {err("pin")}
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t bg-background/90 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Collectors will contact <strong className="text-foreground">{currentUser.name}</strong>
          {currentUser.phone ? ` on ${currentUser.phone}` : ""}.
          {errors.phone && <span className="block text-destructive">{errors.phone}</span>}
        </p>
        <Button type="submit" size="lg" className="h-11 px-6" disabled={publish.isPending}>
          {publish.isPending && <LoaderCircleIcon className="animate-spin" />}
          {publish.isPending ? (photos.length ? "Uploading photos…" : "Publishing…") : "Publish listing"}
        </Button>
      </div>
    </form>
  );
}
