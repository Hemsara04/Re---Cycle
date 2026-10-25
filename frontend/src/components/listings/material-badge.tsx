import {
  BoxIcon,
  CpuIcon,
  LeafIcon,
  type LucideIcon,
  MilkIcon,
  ShirtIcon,
  WineIcon,
  WrenchIcon,
} from "lucide-react";
import { material } from "@/lib/materials";
import type { MaterialId } from "@/lib/types";
import { cn } from "@/lib/utils";

export const MATERIAL_ICONS: Record<MaterialId, LucideIcon> = {
  plastic: MilkIcon,
  glass: WineIcon,
  paper: BoxIcon,
  metal: WrenchIcon,
  ewaste: CpuIcon,
  textile: ShirtIcon,
  organic: LeafIcon,
};

export function MaterialBadge({ id, className }: { id: MaterialId; className?: string }) {
  const m = material(id);
  const Icon = MATERIAL_ICONS[id];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ backgroundColor: `${m.color}1f`, color: m.color }}
    >
      <Icon className="size-3.5" />
      {m.label}
    </span>
  );
}

export function MaterialDot({ id, className }: { id: MaterialId; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: material(id).color }}
    />
  );
}

/** Photo if the seller uploaded one, otherwise a tinted tile with the material icon. */
export function ListingThumb({
  id,
  photo,
  className,
}: {
  id: MaterialId;
  photo?: string;
  className?: string;
}) {
  const m = material(id);
  const Icon = MATERIAL_ICONS[id];
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs
    return <img src={photo} alt="" className={cn("object-cover", className)} />;
  }
  return (
    <div
      className={cn("grid place-items-center", className)}
      style={{
        background: `radial-gradient(circle at 30% 20%, ${m.color}40, ${m.color}14 70%)`,
      }}
    >
      <Icon className="size-1/3 max-h-12 max-w-12" style={{ color: m.color }} strokeWidth={1.5} />
    </div>
  );
}
