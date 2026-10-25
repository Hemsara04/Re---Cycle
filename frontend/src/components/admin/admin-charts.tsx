"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MATERIALS } from "@/lib/materials";
import type { AdminStats } from "@/lib/types";

/** Shape admin_stats() output for the charts. */
export function toWeekly(stats: AdminStats) {
  return stats.listingsPerWeek.map((w) => ({
    week: new Date(w.weekStart + "T00:00:00").toLocaleDateString("en-LK", { day: "numeric", month: "short" }),
    listings: w.count,
  }));
}

export function toMaterials(stats: AdminStats) {
  const byId = new Map(stats.topMaterials.map((m) => [m.material, m]));
  return MATERIALS.map((m) => ({
    id: m.id,
    name: m.label,
    color: m.color,
    count: byId.get(m.id)?.count ?? 0,
    kg: byId.get(m.id)?.kg ?? 0,
  })).sort((a, b) => b.count - a.count);
}

export function claimSummary(stats: AdminStats) {
  const { pending = 0, accepted = 0, declined = 0, cancelled = 0 } = stats.claims;
  const decided = accepted + declined;
  return { pending, accepted, declined, cancelled, total: pending + accepted + declined, rate: decided ? accepted / decided : 0 };
}

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number; payload: Record<string, unknown> }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground">{label ?? String(p.payload.name)}</div>
      <div className="font-semibold text-popover-foreground tabular-nums">
        {p.value} {unit}
        {typeof p.payload.kg === "number" && <span className="font-normal text-muted-foreground"> · {p.payload.kg} kg</span>}
      </div>
    </div>
  );
}

export function ListingsPerWeekChart({ data }: { data: { week: string; listings: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip unit="listings" />} />
        <Bar dataKey="listings" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopMaterialsChart({ data }: { data: ReturnType<typeof toMaterials> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap={4}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={118} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip unit="listings" />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", fill: "var(--muted-foreground)", fontSize: 12 }}>
          {data.map((d) => (
            <Cell key={d.id} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
