"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClockIcon,
  FlagIcon,
  HandIcon,
  LoaderCircleIcon,
  LockIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  UserIcon,
} from "lucide-react";
import { ListingThumb, MaterialBadge } from "@/components/listings/material-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { callLink, whatsappLink } from "@/lib/contact";
import { formatDate, formatKg, timeAgo } from "@/lib/format";
import { PROVINCE_MAP } from "@/lib/locations";
import { cancelClaim, fetchMyClaimFor, QUERY_KEYS, reportListing, requestClaim } from "@/lib/supabase/api";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListingDetailSheet({
  listing,
  onOpenChange,
}: {
  listing: Listing | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!listing} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {listing && <ListingDetail key={listing.id} listing={listing} />}
      </SheetContent>
    </Sheet>
  );
}

function ListingDetail({ listing }: { listing: Listing }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("Hi! I'd like to collect this during your pickup window.");
  const [mode, setMode] = useState<"idle" | "claim" | "report">("idle");
  const [reason, setReason] = useState("");

  const isOwner = user?.id === listing.sellerId;
  const myClaim = useQuery({
    queryKey: QUERY_KEYS.myClaimFor(listing.id),
    queryFn: () => fetchMyClaimFor(listing.id, user!.id),
    enabled: !!user && !isOwner,
  });

  const refreshClaims = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myClaimFor(listing.id) }),
      queryClient.invalidateQueries({ queryKey: ["claims"] }),
    ]);

  const claim = useMutation({
    mutationFn: () => requestClaim(listing.id, message.trim()),
    onSuccess: async () => {
      await refreshClaims();
      toast.success("Claim request sent", { description: "The seller will accept or decline it." });
      setMode("idle");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelClaim(id),
    onSuccess: async () => {
      await refreshClaims();
      toast("Request cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const report = useMutation({
    mutationFn: () => reportListing(listing.id, reason.trim()),
    onSuccess: () => {
      toast("Thanks — an admin will review this listing.");
      setMode("idle");
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const current = myClaim.data;
  const canRequest = listing.status === "available" && (!current || current.status === "cancelled" || current.status === "declined");

  return (
    <>
      <div className="relative">
        <ListingThumb id={listing.material} photo={listing.photos[0]} className="aspect-[16/10] w-full" />
        {listing.photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3 pb-0">
            {listing.photos.map((p, i) => (
              <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URLs */}
                <img src={p} alt={`Photo ${i + 1}`} className="size-16 rounded-md object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      <SheetHeader className="pt-0">
        <div className="flex items-center gap-2">
          <MaterialBadge id={listing.material} />
          {listing.status === "claimed" && <Badge variant="secondary">Claimed</Badge>}
          {listing.distanceKm != null && (
            <span className="text-xs font-medium text-primary">{listing.distanceKm < 1 ? "<1" : Math.round(listing.distanceKm)} km away</span>
          )}
        </div>
        <SheetTitle className="font-heading text-2xl">{listing.title}</SheetTitle>
        <SheetDescription>
          Posted {timeAgo(listing.createdAt)} · {listing.district}, {PROVINCE_MAP[listing.province].label} Province
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-6">
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Quantity</dt>
            <dd className="font-heading text-xl font-bold">{formatKg(listing.quantityKg)}</dd>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClockIcon className="size-3" /> Pickup window
            </dt>
            <dd className="font-medium">{formatDate(listing.pickup.date)}</dd>
            <dd className="text-sm text-muted-foreground">
              {listing.pickup.from} – {listing.pickup.to}
            </dd>
          </div>
        </dl>

        {listing.description && <p className="text-sm leading-relaxed text-muted-foreground">{listing.description}</p>}

        <div className="flex items-center gap-3 text-sm">
          <span className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <UserIcon className="size-4" />
          </span>
          <div>
            <div className="font-medium">{listing.sellerName}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="size-3" /> Pickup near {listing.district}
            </div>
          </div>
        </div>

        {/* contact: phone numbers are only sent to signed-in users */}
        {!user ? (
          <Link href={loginHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 w-full")}>
            <LockIcon /> Sign in to WhatsApp or call the seller
          </Link>
        ) : listing.sellerPhone && !isOwner ? (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={whatsappLink(listing)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "lg" }), "h-11 bg-[#25D366] text-white hover:bg-[#1ebe5a]")}
            >
              <MessageCircleIcon /> WhatsApp
            </a>
            <a href={callLink(listing.sellerPhone)} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
              <PhoneIcon /> Call
            </a>
          </div>
        ) : !isOwner ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            This seller hasn&apos;t added a phone number. Send a claim request instead.
          </p>
        ) : null}

        <Separator />

        {isOwner ? (
          <p className="text-sm text-muted-foreground">
            This is your listing. Manage claim requests from your{" "}
            <Link href="/dashboard" className="font-medium text-primary underline-offset-4 hover:underline">
              dashboard
            </Link>
            .
          </p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">
            <Link href={loginHref} className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>{" "}
            to send a claim request to the seller.
          </p>
        ) : myClaim.isPending ? (
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
        ) : current && !canRequest ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm">
            <span>
              Your request is{" "}
              <Badge variant={current.status === "accepted" ? "default" : "secondary"} className="capitalize">
                {current.status}
              </Badge>
            </span>
            {current.status === "pending" && (
              <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate(current.id)}>
                Cancel request
              </Button>
            )}
          </div>
        ) : !user.approved ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your account is waiting for admin approval before you can claim.</p>
        ) : canRequest && mode === "claim" ? (
          <div className="space-y-2">
            <Textarea value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button className="flex-1" size="lg" disabled={claim.isPending} onClick={() => claim.mutate()}>
                {claim.isPending && <LoaderCircleIcon className="animate-spin" />} Send request
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </div>
          </div>
        ) : canRequest ? (
          <Button size="lg" variant="secondary" className="h-11 w-full" onClick={() => setMode("claim")}>
            <HandIcon /> {current ? "Request again" : "Request to claim"}
          </Button>
        ) : null}

        {!isOwner &&
          user &&
          (mode === "report" ? (
            <div className="space-y-2">
              <Textarea
                placeholder="What's wrong with this listing?"
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button variant="destructive" disabled={reason.trim().length < 3 || report.isPending} onClick={() => report.mutate()}>
                  Submit report
                </Button>
                <Button variant="ghost" onClick={() => setMode("idle")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMode("report")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <FlagIcon className="size-3" /> Report this listing
            </button>
          ))}
      </div>
    </>
  );
}
