import { material } from "./materials";
import type { Listing } from "./types";

/** 0771234567 → 94771234567 (wa.me wants the international form without +). */
export function toInternational(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("94")) return digits;
  if (digits.startsWith("0")) return "94" + digits.slice(1);
  return digits;
}

export function whatsappLink(listing: Listing) {
  const text = `Hi ${listing.sellerName.split(" ")[0]}, I saw your listing "${listing.title}" (${listing.quantityKg} kg ${material(listing.material).label}) on Re-සයිකල් LK. Is it still available for pickup?`;
  return `https://wa.me/${toInternational(listing.sellerPhone ?? "")}?text=${encodeURIComponent(text)}`;
}

export function callLink(phone: string) {
  return `tel:+${toInternational(phone)}`;
}
