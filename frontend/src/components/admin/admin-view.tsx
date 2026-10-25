"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckIcon, DownloadIcon, FlagIcon, LoaderCircleIcon, RotateCcwIcon, SearchIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react";
import { claimSummary, ListingsPerWeekChart, TopMaterialsChart, toMaterials, toWeekly } from "@/components/admin/admin-charts";
import { MaterialBadge } from "@/components/listings/material-badge";
import { SimpleSelect } from "@/components/simple-select";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatKg, timeAgo } from "@/lib/format";
import { PROVINCE_MAP } from "@/lib/locations";
import { material } from "@/lib/materials";
import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchAllClaims,
  fetchAllListings,
  fetchReports,
  QUERY_KEYS,
  resolveReport,
  setListingStatus,
  setUserApproved,
} from "@/lib/supabase/api";
import { cn } from "@/lib/utils";

const stamp = () => new Date().toISOString().slice(0, 10);
const Loading = () => <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

export function AdminView() {
  const { ready, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const [userFilter, setUserFilter] = useState("pending");
  const [listingQuery, setListingQuery] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const stats = useQuery({ queryKey: QUERY_KEYS.adminStats, queryFn: fetchAdminStats, enabled: isAdmin });
  const users = useQuery({ queryKey: QUERY_KEYS.adminUsers, queryFn: fetchAdminUsers, enabled: isAdmin });
  const listings = useQuery({ queryKey: QUERY_KEYS.adminListings, queryFn: fetchAllListings, enabled: isAdmin });
  const reports = useQuery({ queryKey: QUERY_KEYS.adminReports, queryFn: fetchReports, enabled: isAdmin });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin"] }),
      queryClient.invalidateQueries({ queryKey: ["listings"] }),
    ]);
  const onError = (e: Error) => toast.error(e.message);

  const approve = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean; name: string }) => setUserApproved(id, approved),
    onSuccess: async (_, v) => {
      await refresh();
      toast.success(v.approved ? `${v.name} approved` : `${v.name}'s approval revoked`);
    },
    onError,
  });
  const removeListing = useMutation({
    mutationFn: ({ id }: { id: string; reportId?: string }) => setListingStatus(id, "removed"),
    onSuccess: async (_, v) => {
      if (v.reportId) await resolveReport(v.reportId, user!.id);
      await refresh();
      toast(v.reportId ? "Listing removed and report closed" : "Listing removed");
    },
    onError,
  });
  const resolve = useMutation({
    mutationFn: (id: string) => resolveReport(id, user!.id),
    onSuccess: refresh,
    onError,
  });

  const weekly = useMemo(() => (stats.data ? toWeekly(stats.data) : []), [stats.data]);
  const materials = useMemo(() => (stats.data ? toMaterials(stats.data) : []), [stats.data]);
  const claims = useMemo(() => (stats.data ? claimSummary(stats.data) : null), [stats.data]);

  if (!ready) return <div className="h-96 animate-pulse rounded-3xl bg-muted" />;
  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <ShieldAlertIcon className="mx-auto size-8 text-muted-foreground" />
          <CardTitle>Admins only</CardTitle>
          <CardDescription>{user ? "Your account doesn't have admin access." : "Sign in with an admin account to see this page."}</CardDescription>
        </CardHeader>
        {!user && (
          <CardContent>
            <Link href="/login?next=/admin" className={buttonVariants({ size: "lg" })}>Sign in</Link>
          </CardContent>
        )}
      </Card>
    );
  }

  const people = (users.data ?? []).filter((u) => u.role !== "admin");
  const shownUsers = people.filter((u) => (userFilter === "pending" ? !u.approved : userFilter === "all" ? true : u.role === userFilter));
  const q = listingQuery.trim().toLowerCase();
  const shownListings = (listings.data ?? []).filter(
    (l) => !q || [l.title, l.district, l.sellerName, material(l.material).label].some((s) => s.toLowerCase().includes(q)),
  );
  const openReports = (reports.data ?? []).filter((r) => !r.resolved);
  const totals = stats.data?.totals;
  const thisWeek = weekly.at(-1)?.listings ?? 0;
  const lastWeek = weekly.at(-2)?.listings ?? 0;

  const exportCsv = async (kind: "listings" | "claims" | "users") => {
    setExporting(kind);
    try {
      if (kind === "listings") {
        const rows = listings.data ?? (await fetchAllListings());
        downloadCsv(
          `recycle-lk-listings-${stamp()}.csv`,
          toCsv(
            rows.map((l) => ({
              id: l.id,
              title: l.title,
              material: material(l.material).label,
              quantity_kg: l.quantityKg,
              province: PROVINCE_MAP[l.province].label,
              district: l.district,
              lat: l.location.lat.toFixed(5),
              lng: l.location.lng.toFixed(5),
              seller: l.sellerName,
              status: l.status,
              pickup_date: l.pickup.date,
              created_at: l.createdAt,
            })),
            ["id", "title", "material", "quantity_kg", "province", "district", "lat", "lng", "seller", "status", "pickup_date", "created_at"],
          ),
        );
      } else if (kind === "claims") {
        const rows = await fetchAllClaims();
        downloadCsv(
          `recycle-lk-claims-${stamp()}.csv`,
          toCsv(
            rows.map((c) => ({
              id: c.id,
              listing_id: c.listingId,
              listing: c.listing?.title ?? "",
              material: c.listing ? material(c.listing.material).label : "",
              quantity_kg: c.listing?.quantityKg ?? "",
              collector: c.collectorName,
              status: c.status,
              created_at: c.createdAt,
            })),
            ["id", "listing_id", "listing", "material", "quantity_kg", "collector", "status", "created_at"],
          ),
        );
      } else {
        const rows = users.data ?? (await fetchAdminUsers());
        downloadCsv(
          `recycle-lk-users-${stamp()}.csv`,
          toCsv(
            rows.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, approved: u.approved, listings: u.listingCount, created_at: u.createdAt })),
            ["id", "name", "email", "phone", "role", "approved", "listings", "created_at"],
          ),
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground">Moderate the exchange and pull reports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["listings", "claims", "users"] as const).map((k) => (
            <Button key={k} variant="outline" disabled={exporting !== null} onClick={() => exportCsv(k)}>
              {exporting === k ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
              <span className="capitalize">{k}</span> CSV
            </Button>
          ))}
        </div>
      </div>

      {stats.isError && <p className="text-sm text-destructive">{stats.error.message}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Live listings", value: totals?.liveListings, sub: totals ? `${formatKg(totals.kgAvailable)} available` : "" },
          { label: "New this week", value: stats.data ? thisWeek : undefined, sub: stats.data ? `${thisWeek >= lastWeek ? "+" : ""}${thisWeek - lastWeek} vs last week` : "" },
          {
            label: "Claim acceptance",
            value: claims ? `${Math.round(claims.rate * 100)}%` : undefined,
            sub: claims ? `${claims.accepted} accepted · ${claims.declined} declined · ${claims.pending} pending` : "",
          },
          {
            label: "Needs attention",
            value: totals ? totals.pendingApprovals + totals.openReports : undefined,
            sub: totals ? `${totals.pendingApprovals} approvals · ${totals.openReports} reports` : "",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-heading text-3xl font-bold tabular-nums">
              {s.value ?? <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted align-middle" />}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="flex-wrap">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="users">
            Users{(totals?.pendingApprovals ?? 0) > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{totals!.pendingApprovals}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="reports">
            Reports{openReports.length > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">{openReports.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Listings per week</CardTitle>
              <CardDescription>New listings posted, last 8 weeks</CardDescription>
            </CardHeader>
            <CardContent>{stats.data ? <ListingsPerWeekChart data={weekly} /> : <Loading />}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top materials</CardTitle>
              <CardDescription>Listings by material, excluding removed</CardDescription>
            </CardHeader>
            <CardContent>{stats.data ? <TopMaterialsChart data={materials} /> : <Loading />}</CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Claim outcomes</CardTitle>
              <CardDescription>
                {claims?.total ?? 0} claim requests · acceptance rate is accepted ÷ (accepted + declined)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {claims && claims.total > 0 ? (
                <>
                  <div
                    className="flex h-3 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${claims.accepted} accepted, ${claims.pending} pending, ${claims.declined} declined`}
                  >
                    {(
                      [
                        ["accepted", "bg-primary"],
                        ["pending", "bg-primary/40"],
                        ["declined", "bg-muted-foreground/40"],
                      ] as const
                    ).map(([k, cls]) =>
                      claims[k] > 0 ? (
                        <div key={k} className={cn(cls, "border-r-2 border-card last:border-r-0")} style={{ width: `${(claims[k] / claims.total) * 100}%` }} />
                      ) : null,
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> Accepted <strong className="tabular-nums">{claims.accepted}</strong></span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary/40" /> Pending <strong className="tabular-nums">{claims.pending}</strong></span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-muted-foreground/40" /> Declined <strong className="tabular-nums">{claims.declined}</strong></span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No claims yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-3">
          <SimpleSelect
            className="w-48"
            value={userFilter}
            onChange={setUserFilter}
            options={[
              { value: "pending", label: "Awaiting approval" },
              { value: "all", label: "All users" },
              { value: "seller", label: "Sellers" },
              { value: "collector", label: "Collectors" },
              { value: "business", label: "Businesses" },
              { value: "recycler", label: "Recyclers" },
            ]}
          />
          {users.isPending ? (
            <Loading />
          ) : users.isError ? (
            <p className="text-sm text-destructive">{users.error.message}</p>
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Joined</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || "—"}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{u.email}</TableCell>
                      <TableCell className="capitalize">{u.role}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{timeAgo(u.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {u.approved ? (
                          <Button variant="ghost" size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: u.id, approved: false, name: u.name })}>
                            <RotateCcwIcon /> Revoke
                          </Button>
                        ) : (
                          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: u.id, approved: true, name: u.name })}>
                            <CheckIcon /> Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {shownUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nobody here 🎉</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="listings" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search title, district, seller…" value={listingQuery} onChange={(e) => setListingQuery(e.target.value)} className="h-9 pl-9" />
          </div>
          {listings.isPending ? (
            <Loading />
          ) : listings.isError ? (
            <p className="text-sm text-destructive">{listings.error.message}</p>
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead className="hidden md:table-cell">Material</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="hidden sm:table-cell">District</TableHead>
                    <TableHead className="hidden lg:table-cell">Seller</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownListings.slice(0, 200).map((l) => (
                    <TableRow key={l.id} className={cn(l.status === "removed" && "opacity-50")}>
                      <TableCell className="max-w-48 truncate font-medium">{l.title}</TableCell>
                      <TableCell className="hidden md:table-cell"><MaterialBadge id={l.material} /></TableCell>
                      <TableCell className="text-right tabular-nums">{formatKg(l.quantityKg)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{l.district}</TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{l.sellerName}</TableCell>
                      <TableCell><Badge variant={l.status === "available" ? "default" : "secondary"} className="capitalize">{l.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {l.status !== "removed" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${l.title}`}
                            className="text-destructive"
                            disabled={removeListing.isPending}
                            onClick={() => removeListing.mutate({ id: l.id })}
                          >
                            <Trash2Icon />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {shownListings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No listings</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-3">
          {reports.isPending && <Loading />}
          {reports.isError && <p className="text-sm text-destructive">{reports.error.message}</p>}
          {reports.isSuccess && reports.data.length === 0 && <p className="text-sm text-muted-foreground">No reports.</p>}
          {reports.data?.map((r) => (
            <div key={r.id} className={cn("flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4", r.resolved && "opacity-60")}>
              <FlagIcon className={cn("size-5", r.resolved ? "text-muted-foreground" : "text-destructive")} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">“{r.reason}”</div>
                <div className="text-xs text-muted-foreground">
                  {r.reporterName} · {timeAgo(r.createdAt)} · on <strong>{r.listingTitle}</strong>
                  {r.sellerName && ` by ${r.sellerName}`}
                  {r.listingStatus === "removed" && " (removed)"}
                </div>
              </div>
              {!r.resolved && (
                <div className="flex gap-2">
                  {r.listingStatus && r.listingStatus !== "removed" && (
                    <Button variant="destructive" size="sm" disabled={removeListing.isPending} onClick={() => removeListing.mutate({ id: r.listingId, reportId: r.id })}>
                      <Trash2Icon /> Remove listing
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate(r.id)}>
                    Dismiss
                  </Button>
                </div>
              )}
              {r.resolved && <Badge variant="secondary">Resolved</Badge>}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
