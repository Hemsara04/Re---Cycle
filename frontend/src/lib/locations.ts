import type { LatLng, ProvinceId } from "./types";

export type Province = {
  id: ProvinceId;
  label: string;
  // [[south, west], [north, east]] — used to zoom the map when a province is selected
  bounds: [[number, number], [number, number]];
  districts: { name: string; center: LatLng }[];
};

export const PROVINCES: Province[] = [
  {
    id: "western",
    label: "Western",
    bounds: [[6.4, 79.8], [7.35, 80.35]],
    districts: [
      { name: "Colombo", center: { lat: 6.9271, lng: 79.8612 } },
      { name: "Gampaha", center: { lat: 7.0873, lng: 79.9925 } },
      { name: "Kalutara", center: { lat: 6.5854, lng: 79.9607 } },
    ],
  },
  {
    id: "central",
    label: "Central",
    bounds: [[6.75, 80.4], [7.95, 81.05]],
    districts: [
      { name: "Kandy", center: { lat: 7.2906, lng: 80.6337 } },
      { name: "Matale", center: { lat: 7.4675, lng: 80.6234 } },
      { name: "Nuwara Eliya", center: { lat: 6.9497, lng: 80.7891 } },
    ],
  },
  {
    id: "southern",
    label: "Southern",
    bounds: [[5.9, 80.0], [6.5, 81.45]],
    districts: [
      { name: "Galle", center: { lat: 6.0535, lng: 80.221 } },
      { name: "Matara", center: { lat: 5.9549, lng: 80.555 } },
      { name: "Hambantota", center: { lat: 6.1241, lng: 81.1185 } },
    ],
  },
  {
    id: "northern",
    label: "Northern",
    bounds: [[8.4, 79.6], [9.85, 80.9]],
    districts: [
      { name: "Jaffna", center: { lat: 9.6615, lng: 80.0255 } },
      { name: "Kilinochchi", center: { lat: 9.3803, lng: 80.377 } },
      { name: "Mannar", center: { lat: 8.981, lng: 79.9044 } },
      { name: "Vavuniya", center: { lat: 8.7514, lng: 80.4971 } },
      { name: "Mullaitivu", center: { lat: 9.2671, lng: 80.8142 } },
    ],
  },
  {
    id: "eastern",
    label: "Eastern",
    bounds: [[6.6, 80.9], [8.95, 81.95]],
    districts: [
      { name: "Trincomalee", center: { lat: 8.5874, lng: 81.2152 } },
      { name: "Batticaloa", center: { lat: 7.7102, lng: 81.6924 } },
      { name: "Ampara", center: { lat: 7.2975, lng: 81.682 } },
    ],
  },
  {
    id: "north-western",
    label: "North Western",
    bounds: [[7.2, 79.7], [8.5, 80.6]],
    districts: [
      { name: "Kurunegala", center: { lat: 7.4863, lng: 80.3623 } },
      { name: "Puttalam", center: { lat: 8.0362, lng: 79.8283 } },
    ],
  },
  {
    id: "north-central",
    label: "North Central",
    bounds: [[7.4, 80.1], [8.95, 81.3]],
    districts: [
      { name: "Anuradhapura", center: { lat: 8.3114, lng: 80.4037 } },
      { name: "Polonnaruwa", center: { lat: 7.9403, lng: 81.0188 } },
    ],
  },
  {
    id: "uva",
    label: "Uva",
    bounds: [[6.2, 80.75], [7.6, 81.75]],
    districts: [
      { name: "Badulla", center: { lat: 6.9934, lng: 81.055 } },
      { name: "Monaragala", center: { lat: 6.8728, lng: 81.3507 } },
    ],
  },
  {
    id: "sabaragamuwa",
    label: "Sabaragamuwa",
    bounds: [[6.15, 80.1], [7.35, 80.9]],
    districts: [
      { name: "Ratnapura", center: { lat: 6.6828, lng: 80.3992 } },
      { name: "Kegalle", center: { lat: 7.2513, lng: 80.3464 } },
    ],
  },
];

export const PROVINCE_MAP = Object.fromEntries(
  PROVINCES.map((p) => [p.id, p]),
) as Record<ProvinceId, Province>;

export const SRI_LANKA_CENTER: LatLng = { lat: 7.8731, lng: 80.7718 };
export const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [
  [5.7, 79.3],
  [10.0, 82.1],
];

/** Haversine distance in km. Client-side stand-in until PostGIS ST_DWithin is wired up. */
export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Best-effort guess of province + nearest district for a dropped pin. */
export function locate(point: LatLng): { province: ProvinceId; district: string } {
  let best = { province: PROVINCES[0].id, district: PROVINCES[0].districts[0].name, d: Infinity };
  for (const p of PROVINCES) {
    for (const d of p.districts) {
      const dist = distanceKm(point, d.center);
      if (dist < best.d) best = { province: p.id, district: d.name, d: dist };
    }
  }
  return { province: best.province, district: best.district };
}
