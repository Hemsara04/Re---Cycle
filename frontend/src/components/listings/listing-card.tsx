import { CalendarIcon, MapPinIcon, NavigationIcon } from "lucide-react";
import { ListingThumb, MaterialBadge } from "@/components/listings/material-badge";
import { formatDate, formatKg, timeAgo } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListingCard({
  listing,
  distance,
  active,
  onSelect,
}: {
  listing: Listing;
  distance?: number;
  active?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full gap-3 rounded-xl border bg-card p-2.5 text-left transition-all hover:border-primary/40 hover:shadow-sm",
        active && "border-primary ring-3 ring-primary/20",
      )}
    >
      <ListingThumb id={listing.material} photo={listing.photos[0]} className="size-20 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold leading-tight" style={{ fontFamily: "inherit", letterSpacing: 0 }}>
            {listing.title}
          </h3>
          <span className="shrink-0 font-heading text-sm font-bold tabular-nums">{formatKg(listing.quantityKg)}</span>
        </div>
        <MaterialBadge id={listing.material} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="size-3" /> {listing.district}
          </span>
          {distance != null && (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <NavigationIcon className="size-3" /> {distance < 1 ? "<1" : Math.round(distance)} km
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-3" /> {formatDate(listing.pickup.date)}
          </span>
          <span className="ml-auto">{timeAgo(listing.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}
