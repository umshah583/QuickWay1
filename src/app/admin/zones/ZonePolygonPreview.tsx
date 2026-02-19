'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ZonePolygonPreviewProps {
  polygon?: { type: string; coordinates: number[][][] } | null;
}

export function ZonePolygonPreview({ polygon }: ZonePolygonPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const container = containerRef.current;
    const containerWithLeaflet = container as HTMLDivElement & { _leaflet_id?: number };
    if (containerWithLeaflet._leaflet_id) {
      delete containerWithLeaflet._leaflet_id;
    }

    const defaultCenter: [number, number] = [25.2048, 55.2708];
    const map = L.map(container, {
      center: defaultCenter,
      zoom: 11,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      polygonLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    polygonLayerRef.current?.remove();
    polygonLayerRef.current = null;

    if (!polygon || polygon.type !== 'Polygon' || !polygon.coordinates?.[0]) {
      return;
    }

    const latLngs = polygon.coordinates[0]
      .filter((coord) => Array.isArray(coord) && coord.length === 2)
      .map(([lng, lat]) => L.latLng(lat, lng));

    if (latLngs.length < 3) {
      return;
    }

    const layer = L.polygon(latLngs, {
      color: '#7c3aed',
      weight: 2,
      fillOpacity: 0.15,
    }).addTo(map);

    polygonLayerRef.current = layer;

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
    }
  }, [polygon]);

  return <div ref={containerRef} className="h-72 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-secondary)]" />;
}
