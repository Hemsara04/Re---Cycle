"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckIcon, MessageCircleIcon, PackageOpenIcon, PlusIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react";
import { initials } from "@/components/site-header";
import { ListingThumb, MaterialBadge } from "@/components/listings/material-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { toInternational } from "@/lib/contact";
import { formatDate, formatKg, timeAgo } from "@/lib/format";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import {
  cancelClaim,
  fetchIncomingClaims,
  fetchMyClaims,
  fetchMyListings,
  QUERY_KEYS,
  respondToClaim,
  setListingStatus,
} from "@/lib/supabase/api";
import type { ClaimStatus, ListingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ClaimStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  accepted: "bg-primary/15 text-primary",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function StatusPill({ status }: { status: ClaimStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[status])}>{status}</span>;
}

const Skeleton = () => <div className="h-28 animate-pulse rounded-2xl bg-muted" />;

export function DashboardView() {
  const { ready, user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const uid = user?.id;

  const mine = useQuery({ queryKey: QUERY_KEYS.myListings, queryFn: () => fetchMyListings(uid!), enabled: !!uid });
  const incoming = useQuery({ queryKey: QUERY_KEYS.incomingClaims, queryFn: () => fetchIncomingClaims(uid!), enabled: !!uid });
  const outgoing = useQuery({ queryKey: QUERY_KEYS.myClaims, queryFn: () => fetchMyClaims(uid!), enabled: !!uid });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["listings"] }),
      queryClient.invalidateQueries({ queryKey: ["claims"] }),
    ]);

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean; name: string }) => respondToClaim(id, accept),
    onSuccess: async (_, v) => {
      await refresh();
      if (v.accept) toast.success(`Accepted ${v.name.split(" ")[0]}'s request`, { description: "Your listing is now marked as claimed." });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ListingStatus }) => setListingStatus(id, status),
    onSuccess: async (_, v) => {
      await refresh();
      toast(v.status === "removed" ? "Listing removed" : "Listing is available again");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelClaim(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const saveProfile = useMutation({
    mutationFn: (patch: { name?: string; phone?: string }) => updateProfile(patch),
    onSuccess: () => {
      setPhone(null);
      setName(null);
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ready) return <div className="h-96 animate-pulse rounded-3xl bg-muted" />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Sign in to see your dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/login?next=/dashboard" className={buttonVariants({ size: "lg" })}>Sign in</Link>
        </CardContent>
      </Card>
    );
  }

  const listings = mine.data ?? [];
  const requests = incoming.data ?? [];
  const pendingIncoming = requests.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary font-heading text-xl font-bold text-primary-foreground">
          {initials(user.name || user.email || "?")}
        </span>
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold">Hi, {user.name.split(" ")[0] || "there"}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="capitalize">{user.role}</span> account
            {!user.approved && <Badge variant="secondary" className="ml-2">Awaiting admin approval</Badge>}
          </p>
        </div>
        <Link href="/post" className={cn(buttonVariants({ size: "lg" }), "h-10")}>
          <PlusIcon /> New listing
        </Link>
      </div>

      {!user.phone && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Add your WhatsApp number in the <strong>Profile</strong> tab so people can contact you about your listings.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active listings", value: listings.filter((l) => l.status === "available").length },
          { label: "Requests to review", value: pendingIncoming },
          { label: "My claims", value: outgoing.data?.length ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <div className="font-heading text-3xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground sm:text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">
            My listings{pendingIncoming > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{pendingIncoming}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="claims">My claims</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4 space-y-3">
          {mine.isPending && <Skeleton />}
          {mine.isError && <p className="text-sm text-destructive">{mine.error.message}</p>}
          {mine.isSuccess && listings.length === 0 && (
            <div className="flex flex-col items-center rounded-2xl border border-dashed p-10 text-center">
              <PackageOpenIcon className="size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">You haven&apos;t posted anything yet</p>
              <Link href="/post" className={cn(buttonVariants(), "mt-4")}>Post your first listing</Link>
            </div>
          )}
          {listings.map((l) => {
            const reqs = requests.filter((c) => c.listingId === l.id);
            return (
              <Card key={l.id} className="gap-0 py-0">
                <div className="flex gap-4 p-4">
                  <ListingThumb id={l.material} photo={l.photos[0]} className="size-20 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{l.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <MaterialBadge id={l.material} />
                          {formatKg(l.quantityKg)} · {l.district} · pickup {formatDate(l.pickup.date)}
                        </div>
                      </div>
                      <Badge variant={l.status === "available" ? "default" : "secondary"} className="capitalize">
                        {l.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Posted {timeAgo(l.createdAt)}</span>
                      {l.status === "claimed" && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="ml-auto"
                          disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: l.id, status: "available" })}
                        >
                          <RotateCcwIcon /> Relist
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        className={cn("text-destructive", l.status !== "claimed" && "ml-auto")}
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: l.id, status: "removed" })}
                      >
                        <Trash2Icon /> Remove
                      </Button>
                    </div>
                  </div>
                </div>
                {reqs.length > 0 && (
                  <div className="divide-y border-t bg-muted/40">
                    {reqs.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c.collectorName}</span>
                            <StatusPill status={c.status} />
                            <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                          </div>
                          {c.message && <p className="truncate text-muted-foreground">“{c.message}”</p>}
                        </div>
                        {c.status === "pending" ? (
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              disabled={respond.isPending}
                              onClick={() => respond.mutate({ id: c.id, accept: true, name: c.collectorName })}
                            >
                              <CheckIcon /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={respond.isPending}
                              onClick={() => respond.mutate({ id: c.id, accept: false, name: c.collectorName })}
                            >
                              <XIcon /> Decline
                            </Button>
                          </div>
                        ) : c.status === "accepted" && c.collectorPhone ? (
                          <a
                            href={`https://wa.me/${toInternational(c.collectorPhone)}?text=${encodeURIComponent(`Hi ${c.collectorName.split(" ")[0]}, I've accepted your request for "${l.title}". See you on ${formatDate(l.pickup.date)} between ${l.pickup.from} and ${l.pickup.to}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                          >
                            <MessageCircleIcon /> Message
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="claims" className="mt-4 space-y-3">
          {outgoing.isPending && <Skeleton />}
          {outgoing.isError && <p className="text-sm text-destructive">{outgoing.error.message}</p>}
          {outgoing.isSuccess && outgoing.data.length === 0 && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No claim requests yet.{" "}
              <Link href="/find" className="font-medium text-primary hover:underline">Browse the map</Link> to find materials.
            </div>
          )}
          {outgoing.data?.map((c) => {
            const l = c.listing;
            if (!l) return null;
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-3">
                <ListingThumb id={l.material} photo={l.photos[0]} className="size-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{l.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.sellerName} · {l.district} · {formatKg(l.quantityKg)} · pickup {formatDate(l.pickup.date)} {l.pickup.from}–{l.pickup.to}
                  </div>
                </div>
                <StatusPill status={c.status} />
                {c.status === "accepted" && l.sellerPhone && (
                  <a
                    href={`https://wa.me/${toInternational(l.sellerPhone)}?text=${encodeURIComponent(`Hi ${l.sellerName.split(" ")[0]}, thanks for accepting my request for "${l.title}"!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    <MessageCircleIcon /> Message seller
                  </a>
                )}
                {c.status === "pending" && (
                  <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate(c.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Your details</CardTitle>
              <CardDescription>Shown on your listings so collectors can WhatsApp or call you.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const nextPhone = phone ?? user.phone ?? "";
                  if (nextPhone && !isValidPhone(nextPhone)) return toast.error("Enter a Sri Lankan mobile number, e.g. 077 123 4567");
                  saveProfile.mutate({
                    ...(name !== null && { name: name.trim() }),
                    ...(phone !== null && { phone: normalizePhone(phone) }),
                  });
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" maxLength={120} value={name ?? user.name} onChange={(e) => setName(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">WhatsApp number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="077 123 4567"
                    value={phone ?? user.phone ?? ""}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10"
                  />
                </div>
                <Button type="submit" size="lg" className="h-10" disabled={saveProfile.isPending || (name === null && phone === null)}>
                  Save
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">Signed in as {user.email}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
