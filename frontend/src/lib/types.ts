// Mirrors the enums and tables in supabase/migrations.

export type Role = "seller" | "collector" | "business" | "recycler" | "admin";

export type MaterialId =
  | "plastic"
  | "glass"
  | "paper"
  | "metal"
  | "ewaste"
  | "textile"
  | "organic";

export type ProvinceId =
  | "western"
  | "central"
  | "southern"
  | "northern"
  | "eastern"
  | "north-western"
  | "north-central"
  | "uva"
  | "sabaragamuwa";

export type LatLng = { lat: number; lng: number };

/** public.profiles (+ email for the signed-in user and the admin list) */
export type Profile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  approved: boolean;
  createdAt: string;
  /** admin list only */
  listingCount?: number;
};

export type ListingStatus = "available" | "claimed" | "removed";

export type Listing = {
  id: string;
  title: string;
  material: MaterialId;
  quantityKg: number;
  description: string;
  /** public URLs */
  photos: string[];
  pickup: { date: string; from: string; to: string };
  location: LatLng;
  province: ProvinceId;
  district: string;
  sellerId: string;
  sellerName: string;
  /** null for visitors who aren't signed in */
  sellerPhone: string | null;
  status: ListingStatus;
  createdAt: string;
  /** set when searching "near me" */
  distanceKm?: number | null;
};

export type ClaimStatus = "pending" | "accepted" | "declined" | "cancelled";

export type Claim = {
  id: string;
  listingId: string;
  collectorId: string;
  collectorName: string;
  collectorPhone: string | null;
  message: string;
  status: ClaimStatus;
  createdAt: string;
  listing?: Listing;
};

export type Report = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingStatus: ListingStatus | null;
  sellerName: string;
  reason: string;
  reporterName: string;
  createdAt: string;
  resolved: boolean;
};

export type NewListing = {
  title: string;
  material: MaterialId;
  quantityKg: number;
  description: string;
  pickup: { date: string; from: string; to: string };
  location: LatLng;
  province: ProvinceId;
  district: string;
};

export type ListingFilters = {
  q?: string;
  province?: ProvinceId | null;
  district?: string | null;
  materials?: MaterialId[];
  minKg?: number;
  /** only listings posted in the last N days */
  sinceDays?: number | null;
  near?: LatLng | null;
  radiusKm?: number | null;
  sort?: "newest" | "nearest" | "quantity";
  limit?: number;
};

export type AdminStats = {
  listingsPerWeek: { weekStart: string; count: number }[];
  topMaterials: { material: MaterialId; count: number; kg: number }[];
  claims: Record<ClaimStatus, number>;
  totals: { liveListings: number; kgAvailable: number; users: number; pendingApprovals: number; openReports: number };
};
