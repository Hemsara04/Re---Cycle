export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)} d ago`;
  return new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short" });
}

export function formatDate(isoDate: string) {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-LK", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatKg(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${kg % 1 === 0 ? kg : kg.toFixed(1)} kg`;
}
