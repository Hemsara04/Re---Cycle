"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so the maps only ever render on the client.
const Loading = () => <div className="size-full animate-pulse bg-muted" />;

export const ListingsMap = dynamic(() => import("./listings-map"), { ssr: false, loading: Loading });
export const LocationPicker = dynamic(() => import("./location-picker"), { ssr: false, loading: Loading });
