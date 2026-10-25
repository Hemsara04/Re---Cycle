"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { SRI_LANKA_CENTER } from "@/lib/locations";
import type { LatLng, MaterialId } from "@/lib/types";
import { materialIcon, OSM_ATTRIBUTION, OSM_TILES } from "./listings-map";

function ClickToPlace({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value && !map.getBounds().contains([value.lat, value.lng])) {
      map.flyTo([value.lat, value.lng], 14, { duration: 0.8 });
    }
  }, [map, value]);
  return null;
}

export default function LocationPicker({
  value,
  onChange,
  materialId,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  materialId: MaterialId;
}) {
  return (
    <MapContainer
      center={[SRI_LANKA_CENTER.lat, SRI_LANKA_CENTER.lng]}
      zoom={7}
      minZoom={6}
      scrollWheelZoom
      className="size-full cursor-crosshair"
    >
      <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} />
      <ClickToPlace onChange={onChange} />
      <Recenter value={value} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={materialIcon(materialId, true)}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onChange({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
