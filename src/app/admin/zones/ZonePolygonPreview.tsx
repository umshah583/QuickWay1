'use client';

import { useEffect, useRef } from 'react';

interface ZonePolygonPreviewProps {
  polygon?: { type: string; coordinates: number[][][] } | null;
}

export function ZonePolygonPreview({ polygon }: ZonePolygonPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polygonLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let isMounted = true;

    const initializeMap = async () => {
      const leafletModule = await import('leaflet');
      // Import CSS using require to avoid TypeScript issues
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('leaflet/dist/leaflet.css');
      }
      
      if (!isMounted || !containerRef.current) {
        return;
      }

      const L = leafletModule.default ?? leafletModule;
      leafletRef.current = L;

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
    };

    void initializeMap();

    return () => {
      isMounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
      polygonLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leafletModule = leafletRef.current;
    if (!map || !leafletModule) {
      return;
    }

    const L = leafletModule.default ?? leafletModule;

    polygonLayerRef.current?.remove();
    polygonLayerRef.current = null;

    if (!polygon || polygon.type !== 'Polygon' || !polygon.coordinates?.[0]) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latLngs: any[] = polygon.coordinates[0]
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
