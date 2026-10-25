"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { formatKg } from "@/lib/format";
import { SRI_LANKA_BOUNDS, SRI_LANKA_CENTER } from "@/lib/locations";
import { material } from "@/lib/materials";
import type { LatLng, Listing, MaterialId } from "@/lib/types";

export const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const iconCache = new Map<string, L.DivIcon>();
export function materialIcon(id: MaterialId, active = false) {
  const key = `${id}:${active}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      html: `<div class="material-pin${active ? " is-active" : ""}" style="background:${material(id).color}"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 22],
      tooltipAnchor: [0, -22],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function FitView({
  bounds,
  focus,
}: {
  bounds?: [[number, number], [number, number]] | null;
  focus?: LatLng | null;
}) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      // A hidden map (mobile list tab) has no size, and Leaflet produces NaN coords for it
      const size = map.getSize();
      if (!size.x || !size.y) return;
      if (focus) map.flyTo([focus.lat, focus.lng], 11, { duration: 0.8 });
      else if (bounds) map.flyToBounds(bounds, { duration: 0.8, padding: [20, 20] });
      else map.flyToBounds(SRI_LANKA_BOUNDS, { duration: 0.8 });
    };
    fit();
    let wasHidden = map.getSize().x === 0;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      const hidden = map.getContainer().clientWidth === 0;
      if (wasHidden && !hidden) fit();
      wasHidden = hidden;
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map, bounds, focus]);
  return null;
}

function PanToSelected({ listing }: { listing?: Listing }) {
  const map = useMap();
  useEffect(() => {
    if (!listing || !map.getSize().x) return;
    const target = L.latLng(listing.location.lat, listing.location.lng);
    if (!map.getBounds().pad(-0.15).contains(target)) map.panTo(target, { animate: true });
  }, [map, listing]);
  return null;
}

export default function ListingsMap({
  listings,
  selectedId,
  onSelect,
  bounds,
  userLocation,
  radiusKm,
}: {
  listings: Listing[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  bounds?: [[number, number], [number, number]] | null;
  userLocation?: LatLng | null;
  radiusKm?: number | null;
}) {
  const selected = useMemo(() => listings.find((l) => l.id === selectedId), [listings, selectedId]);

  return (
    <MapContainer
      center={[SRI_LANKA_CENTER.lat, SRI_LANKA_CENTER.lng]}
      zoom={7}
      minZoom={6}
      maxBounds={[
        [4.5, 77.5],
        [11, 84],
      ]}
      scrollWheelZoom
      className="size-full"
    >
      <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} />
      <FitView bounds={bounds} focus={userLocation} />
      <PanToSelected listing={selected} />

      {userLocation && (
        <>
          {radiusKm && (
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={radiusKm * 1000}
              pathOptions={{ color: "#3fa34d", weight: 1, fillOpacity: 0.06 }}
            />
          )}
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={7}
            pathOptions={{ color: "#fff", weight: 3, fillColor: "#2f80ed", fillOpacity: 1 }}
          >
            <Tooltip>You are here</Tooltip>
          </CircleMarker>
        </>
      )}

      {listings.map((l) => (
        <Marker
          key={l.id}
          position={[l.location.lat, l.location.lng]}
          icon={materialIcon(l.material, l.id === selectedId)}
          zIndexOffset={l.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect?.(l.id) }}
        >
          <Tooltip direction="top">
            <strong>{l.title}</strong>
            <br />
            {formatKg(l.quantityKg)} · {l.district}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
