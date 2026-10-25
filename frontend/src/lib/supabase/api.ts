/**
 * Every read/write the app makes to Supabase. Components call these through
 * TanStack Query (see QUERY_KEYS); RLS in the database decides what each
 * user may actually see or change.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import type {
  AdminStats,
  Claim,
  ClaimStatus,
  LatLng,
  Listing,
  ListingFilters,
  ListingStatus,
  MaterialId,
  NewListing,
  Profile,
  ProvinceId,
  Report,
  Role,
} from "@/lib/types";
import { supabase } from "./client";

export const PHOTO_BUCKET = "listing-photos";

export const QUERY_KEYS = {
  profile: (id?: string) => ["profile", id] as const,
  search: (f: ListingFilters) => ["listings", "search", f] as const,
  listing: (id: string) => ["listings", "one", id] as const,
  myListings: ["listings", "mine"] as const,
  incomingClaims: ["claims", "incoming"] as const,
  myClaims: ["claims", "mine"] as const,
  myClaimFor: (listingId: string) => ["claims", "for", listingId] as const,
  adminStats: ["admin", "stats"] as const,
  adminUsers: ["admin", "users"] as const,
  adminListings: ["admin", "listings"] as const,
  adminReports: ["admin", "reports"] as const,
};

/** Turn a PostgREST error into a message people can read. */
function fail(error: PostgrestError | Error | null): never {
  const e = error as PostgrestError;
  if (e?.code === "42501" && /row-level security/i.test(e.message)) {
    throw new Error("You don't have permission to do that.");
  }
  throw new Error(e?.message || "Something went wrong. Please try again.");
}

// ─── row mappers ─────────────────────────────────────────────────────────────

export function photoUrl(path: string) {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** PostgREST returns geography columns as hex EWKB. A point is 21 (or 25 with SRID) bytes. */
export function parsePoint(value: unknown): LatLng {
  if (typeof value === "string" && /^[0-9a-f]+$/i.test(value)) {
    const bytes = new Uint8Array(value.match(/../g)!.map((h) => parseInt(h, 16)));
    const view = new DataView(bytes.buffer);
    const littleEndian = view.getUint8(0) === 1;
    const type = view.getUint32(1, littleEndian);
    const offset = 5 + (type & 0x20000000 ? 4 : 0);
    return { lng: view.getFloat64(offset, littleEndian), lat: view.getFloat64(offset + 8, littleEndian) };
  }
  if (value && typeof value === "object" && "coordinates" in value) {
    const [lng, lat] = (value as { coordinates: [number, number] }).coordinates;
    return { lat, lng };
  }
  return { lat: 0, lng: 0 };
}

const hhmm = (t: string) => t.slice(0, 5);

type SearchRow = {
  id: string; title: string; material: MaterialId; quantity_kg: number; description: string; photos: string[];
  pickup_date: string; pickup_from: string; pickup_to: string; lat: number; lng: number;
  province: ProvinceId; district: string; status: ListingStatus; created_at: string;
  seller_id: string; seller_name: string; seller_phone: string | null; distance_km: number | null;
};

function fromSearchRow(r: SearchRow): Listing {
  return {
    id: r.id,
    title: r.title,
    material: r.material,
    quantityKg: Number(r.quantity_kg),
    description: r.description,
    photos: r.photos.map(photoUrl),
    pickup: { date: r.pickup_date, from: hhmm(r.pickup_from), to: hhmm(r.pickup_to) },
    location: { lat: r.lat, lng: r.lng },
    province: r.province,
    district: r.district,
    sellerId: r.seller_id,
    sellerName: r.seller_name,
    sellerPhone: r.seller_phone,
    status: r.status,
    createdAt: r.created_at,
    distanceKm: r.distance_km,
  };
}

type ListingRow = Omit<SearchRow, "lat" | "lng" | "seller_name" | "seller_phone" | "distance_km"> & {
  location: unknown;
  seller?: { full_name: string; phone: string | null } | null;
};

const LISTING_COLUMNS = "*, seller:profiles!listings_seller_id_fkey(full_name, phone)";

function fromListingRow(r: ListingRow): Listing {
  return {
    ...fromSearchRow({ ...r, lat: 0, lng: 0, seller_name: r.seller?.full_name ?? "", seller_phone: r.seller?.phone ?? null, distance_km: null }),
    location: parsePoint(r.location),
  };
}

type ProfileRow = { id: string; full_name: string; phone: string | null; role: Role; approved: boolean; created_at: string };

export function fromProfileRow(r: ProfileRow, email: string | null = null): Profile {
  return { id: r.id, name: r.full_name, email, phone: r.phone, role: r.role, approved: r.approved, createdAt: r.created_at };
}

type ClaimRow = {
  id: string; listing_id: string; collector_id: string; message: string; status: ClaimStatus; created_at: string;
  collector?: { full_name: string; phone: string | null } | null;
  listing?: ListingRow | null;
};

const fromClaimRow = (r: ClaimRow): Claim => ({
  id: r.id,
  listingId: r.listing_id,
  collectorId: r.collector_id,
  collectorName: r.collector?.full_name ?? "",
  collectorPhone: r.collector?.phone ?? null,
  message: r.message,
  status: r.status,
  createdAt: r.created_at,
  listing: r.listing ? fromListingRow(r.listing) : undefined,
});

// ─── profiles ────────────────────────────────────────────────────────────────

export async function fetchProfile(id: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) fail(error);
  return data ? fromProfileRow(data) : null;
}

export async function updateMyProfile(id: string, patch: { name?: string; phone?: string | null }) {
  const { error } = await supabase
    .from("profiles")
    .update({ ...(patch.name !== undefined && { full_name: patch.name }), ...(patch.phone !== undefined && { phone: patch.phone }) })
    .eq("id", id);
  if (error) fail(error.code === "23514" ? new Error("That phone number isn't a valid Sri Lankan mobile number.") : error);
}

export async function chooseInitialRole(role: Exclude<Role, "admin">) {
  const { error } = await supabase.rpc("choose_initial_role", { p_role: role });
  if (error) fail(error);
}

// ─── listings ────────────────────────────────────────────────────────────────

export async function searchListings(f: ListingFilters = {}) {
  const { data, error } = await supabase.rpc("search_listings", {
    q: f.q?.trim() || null,
    p_province: f.province ?? null,
    p_district: f.district ?? null,
    p_materials: f.materials?.length ? f.materials : null,
    p_min_kg: f.minKg ?? 0,
    p_since: f.sinceDays ? new Date(Date.now() - f.sinceDays * 86_400_000).toISOString() : null,
    p_lat: f.near?.lat ?? null,
    p_lng: f.near?.lng ?? null,
    p_radius_km: f.near ? (f.radiusKm ?? null) : null,
    p_sort: f.sort ?? "newest",
    p_limit: f.limit ?? 300,
  });
  if (error) fail(error);
  return (data as SearchRow[]).map(fromSearchRow);
}

export async function getListing(id: string) {
  const { data, error } = await supabase.rpc("search_listings", { p_id: id });
  if (error) fail(error);
  const row = (data as SearchRow[])[0];
  return row ? fromSearchRow(row) : null;
}

/** Uploads photos into `<uid>/…` and creates the listing. Cleans up the photos if the insert fails. */
export async function createListing(sellerId: string, input: NewListing, photos: Blob[]) {
  const paths: string[] = [];
  try {
    for (const photo of photos) {
      const path = `${sellerId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(`Photo upload failed: ${error.message}`);
      paths.push(path);
    }
    const { data, error } = await supabase
      .from("listings")
      .insert({
        title: input.title,
        material: input.material,
        quantity_kg: input.quantityKg,
        description: input.description,
        photos: paths,
        pickup_date: input.pickup.date,
        pickup_from: input.pickup.from,
        pickup_to: input.pickup.to,
        location: `POINT(${input.location.lng} ${input.location.lat})`,
        province: input.province,
        district: input.district,
      })
      .select("id")
      .single();
    if (error) fail(error);
    return data.id as string;
  } catch (err) {
    if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    throw err;
  }
}

export async function setListingStatus(id: string, status: ListingStatus) {
  const { error } = await supabase.from("listings").update({ status }).eq("id", id);
  if (error) fail(error);
}

export async function fetchMyListings(sellerId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("seller_id", sellerId)
    .neq("status", "removed")
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return (data as ListingRow[]).map(fromListingRow);
}

// ─── claims ──────────────────────────────────────────────────────────────────

const CLAIM_COLUMNS = "*, collector:profiles!claims_collector_id_fkey(full_name, phone)";

/** Requests on the signed-in seller's listings. */
export async function fetchIncomingClaims(sellerId: string) {
  const { data, error } = await supabase
    .from("claims")
    .select(`${CLAIM_COLUMNS}, listing:listings!inner(${LISTING_COLUMNS})`)
    .eq("listing.seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return (data as ClaimRow[]).map(fromClaimRow);
}

/** Requests the signed-in user has made. */
export async function fetchMyClaims(collectorId: string) {
  const { data, error } = await supabase
    .from("claims")
    .select(`${CLAIM_COLUMNS}, listing:listings(${LISTING_COLUMNS})`)
    .eq("collector_id", collectorId)
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return (data as ClaimRow[]).map(fromClaimRow);
}

export async function fetchMyClaimFor(listingId: string, collectorId: string) {
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_COLUMNS)
    .eq("listing_id", listingId)
    .eq("collector_id", collectorId)
    .maybeSingle();
  if (error) fail(error);
  return data ? fromClaimRow(data as ClaimRow) : null;
}

export async function requestClaim(listingId: string, message: string) {
  const { error } = await supabase.rpc("request_claim", { p_listing_id: listingId, p_message: message });
  if (error) fail(error);
}

export async function respondToClaim(claimId: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_to_claim", { p_claim_id: claimId, p_accept: accept });
  if (error) fail(error);
}

export async function cancelClaim(claimId: string) {
  const { error } = await supabase.rpc("cancel_claim", { p_claim_id: claimId });
  if (error) fail(error);
}

// ─── reports ─────────────────────────────────────────────────────────────────

export async function reportListing(listingId: string, reason: string) {
  const { error } = await supabase.from("reports").insert({ listing_id: listingId, reason });
  if (error) fail(error);
}

// ─── admin ───────────────────────────────────────────────────────────────────

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc("admin_stats", { p_weeks: 8 });
  if (error) fail(error);
  return {
    listingsPerWeek: data.listings_per_week.map((w: { week_start: string; count: number }) => ({ weekStart: w.week_start, count: Number(w.count) })),
    topMaterials: data.top_materials.map((m: { material: MaterialId; count: number; kg: number }) => ({ material: m.material, count: Number(m.count), kg: Number(m.kg) })),
    claims: data.claims,
    totals: {
      liveListings: data.totals.live_listings,
      kgAvailable: Number(data.totals.kg_available),
      users: data.totals.users,
      pendingApprovals: data.totals.pending_approvals,
      openReports: data.totals.open_reports,
    },
  };
}

export async function fetchAdminUsers() {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) fail(error);
  return (data as (ProfileRow & { email: string; listings: number })[]).map((r) => ({
    ...fromProfileRow(r, r.email),
    listingCount: Number(r.listings),
  }));
}

export async function setUserApproved(id: string, approved: boolean) {
  const { error } = await supabase.from("profiles").update({ approved }).eq("id", id);
  if (error) fail(error);
}

/** Admin RLS can see every listing, including removed ones. */
export async function fetchAllListings() {
  const { data, error } = await supabase.from("listings").select(LISTING_COLUMNS).order("created_at", { ascending: false }).limit(1000);
  if (error) fail(error);
  return (data as ListingRow[]).map(fromListingRow);
}

export async function fetchAllClaims() {
  const { data, error } = await supabase
    .from("claims")
    .select(`${CLAIM_COLUMNS}, listing:listings(${LISTING_COLUMNS})`)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) fail(error);
  return (data as ClaimRow[]).map(fromClaimRow);
}

type ReportRow = {
  id: string; listing_id: string; reason: string; resolved: boolean; created_at: string;
  reporter: { full_name: string } | null;
  listing: { title: string; status: ListingStatus; seller: { full_name: string } | null } | null;
};

export async function fetchReports() {
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, listing_id, reason, resolved, created_at, reporter:profiles!reports_reporter_id_fkey(full_name), listing:listings(title, status, seller:profiles!listings_seller_id_fkey(full_name))",
    )
    .order("resolved")
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return (data as unknown as ReportRow[]).map(
    (r): Report => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.listing?.title ?? "Deleted listing",
      listingStatus: r.listing?.status ?? null,
      sellerName: r.listing?.seller?.full_name ?? "",
      reason: r.reason,
      reporterName: r.reporter?.full_name ?? "",
      createdAt: r.created_at,
      resolved: r.resolved,
    }),
  );
}

export async function resolveReport(id: string, adminId: string) {
  const { error } = await supabase
    .from("reports")
    .update({ resolved: true, resolved_by: adminId, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail(error);
}
