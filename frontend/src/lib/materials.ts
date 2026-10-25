import type { MaterialId } from "./types";

export type Material = {
  id: MaterialId;
  label: string;
  sinhala: string;
  color: string;
  examples: string;
};

// Marker + badge colours. Order matters: it was validated (light + dark, incl. colour-blind
// separation between neighbours) with the dataviz palette checker — keep it fixed.
export const MATERIALS: Material[] = [
  { id: "plastic", label: "Plastic", sinhala: "ප්ලාස්ටික්", color: "#2f80ed", examples: "PET bottles, containers, HDPE cans" },
  { id: "paper", label: "Paper & Cardboard", sinhala: "කඩදාසි", color: "#c08410", examples: "Cardboard sheets, newspapers, boxes" },
  { id: "glass", label: "Glass", sinhala: "වීදුරු", color: "#14a39a", examples: "Bottles, jars, broken panes" },
  { id: "ewaste", label: "E-waste", sinhala: "ඉලෙක්ට්‍රොනික", color: "#9b51e0", examples: "Phones, chargers, circuit boards, batteries" },
  { id: "organic", label: "Organic", sinhala: "කාබනික", color: "#3fa34d", examples: "Coconut husk, garden waste, food scraps" },
  { id: "metal", label: "Metal", sinhala: "ලෝහ", color: "#a8521c", examples: "Aluminium cans, copper wire, scrap iron" },
  { id: "textile", label: "Textile", sinhala: "රෙදි", color: "#e0567a", examples: "Old clothes, fabric off-cuts, sacks" },
];

export const MATERIAL_MAP = Object.fromEntries(
  MATERIALS.map((m) => [m.id, m]),
) as Record<MaterialId, Material>;

export function material(id: MaterialId) {
  return MATERIAL_MAP[id];
}
