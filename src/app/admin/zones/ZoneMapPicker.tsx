'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

interface ZoneMapPickerProps {
  initialPolygon?: { type: string; coordinates: number[][][] } | null;
  onPolygonChange: (polygon: { type: string; coordinates: number[][][] } | null) => void;
  mapHeight?: string;
  showAreaCalculation?: boolean;
  allowDrawing?: boolean;
  allowEditing?: boolean;
}

export function ZoneMapPicker({
  initialPolygon,
  onPolygonChange,
  mapHeight = "400px",
  showAreaCalculation = true,
  allowDrawing = true,
  allowEditing = true,
}: ZoneMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const [areaSqm, setAreaSqm] = useState<number | null>(null);

  // Keep callback ref updated
  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  }, [onPolygonChange]);

  // Calculate area from GeoJSON polygon (simple approximation)
  const calculateArea = (coordinates: number[][][]) => {
    if (!coordinates?.[0]) return null;

    const ring = coordinates[0];
    let area = 0;
    
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      area += lng1 * lat2 - lng2 * lat1;
    }
    
    // Convert to square meters (rough approximation at equator)
    return Math.abs(area / 2) * 111320 * 111320;
  };

  // Convert polygon to GeoJSON
  const polygonToGeoJson = (polygon: L.Polygon): { type: string; coordinates: number[][][] } => {
    const latLngs = polygon.getLatLngs()[0] as L.LatLng[];
    const coordinates = latLngs.map((latLng) => [latLng.lng, latLng.lat]);

    // Close the ring if not already closed
    if (coordinates.length > 0 && (
      coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
      coordinates[0][1] !== coordinates[coordinates.length - 1][1]
    )) {
      coordinates.push(coordinates[0]);
    }

    return {
      type: 'Polygon',
      coordinates: [coordinates],
    };
  };

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const container = containerRef.current;
    const containerWithLeaflet = container as HTMLDivElement & { _leaflet_id?: number };
    if (containerWithLeaflet._leaflet_id) {
      delete containerWithLeaflet._leaflet_id;
    }

    const defaultCenter: [number, number] = [25.2048, 55.2708]; // Dubai
    const map = L.map(container, {
      center: defaultCenter,
      zoom: 11,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;

    // Initialize draw control
    if (allowDrawing) {
      const editableLayer = new L.FeatureGroup();
      map.addLayer(editableLayer);

      const drawOptions: L.Control.DrawConstructorOptions = {
        draw: {
          polyline: false,
          polygon: {
            allowIntersection: false,
            showArea: showAreaCalculation,
            drawError: {
              color: '#e74c3c',
              message: '<strong>Error:</strong> Shape edges cannot cross!',
            },
            shapeOptions: {
              color: '#7c3aed',
              weight: 2,
              fillOpacity: 0.15,
            },
          },
          circle: false,
          marker: false,
          rectangle: false,
          circlemarker: false,
        },
      };

      if (allowEditing) {
        drawOptions.edit = {
          featureGroup: editableLayer,
          remove: true,
        };
      }

      const drawControl = new L.Control.Draw(drawOptions);
      map.addControl(drawControl);
      drawControlRef.current = drawControl;
    }

    // Handle draw events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      if (layer instanceof L.Polygon) {
        // Remove existing polygon
        if (polygonRef.current) {
          map.removeLayer(polygonRef.current);
        }

        // Add new polygon
        polygonRef.current = layer;
        map.addLayer(layer);

        const geoJson = polygonToGeoJson(layer);
        onPolygonChangeRef.current(geoJson);

        if (showAreaCalculation) {
          setAreaSqm(calculateArea(geoJson.coordinates));
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on(L.Draw.Event.EDITED, (e: any) => {
      const layers = e.layers;
      layers.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.Polygon) {
          const geoJson = polygonToGeoJson(layer);
          onPolygonChangeRef.current(geoJson);

          if (showAreaCalculation) {
            setAreaSqm(calculateArea(geoJson.coordinates));
          }
        }
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      if (polygonRef.current) {
        map.removeLayer(polygonRef.current);
        polygonRef.current = null;
      }
      onPolygonChangeRef.current(null);
      setAreaSqm(null);
    });

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      polygonRef.current = null;
      drawControlRef.current = null;
    };
  }, [allowDrawing, allowEditing, showAreaCalculation]);

  // Load initial polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initialPolygon) return;

    // Remove existing polygon
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
    }

    if (initialPolygon.type === 'Polygon' && initialPolygon.coordinates?.[0]) {
      const latLngs = initialPolygon.coordinates[0]
        .filter((coord) => Array.isArray(coord) && coord.length === 2)
        .map(([lng, lat]) => L.latLng(lat, lng));

      if (latLngs.length >= 3) {
        const polygon = L.polygon(latLngs, {
          color: '#7c3aed',
          weight: 2,
          fillOpacity: 0.15,
        }).addTo(map);

        polygonRef.current = polygon;

        // Add to editable layer group if editing allowed
        if (allowEditing && drawControlRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const editLayer = (drawControlRef.current as any).options?.edit?.featureGroup;
          if (editLayer) {
            editLayer.addLayer(polygon);
          }
        }

        map.fitBounds(polygon.getBounds().pad(0.2));

        if (showAreaCalculation) {
          setAreaSqm(calculateArea(initialPolygon.coordinates));
        }
      }
    }
  }, [initialPolygon, allowEditing, showAreaCalculation]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-secondary)]"
        style={{ height: mapHeight }}
      />
      {showAreaCalculation && areaSqm !== null && (
        <div className="text-sm text-[var(--text-muted)]">
          Area: {(areaSqm / 1000000).toFixed(2)} km² ({(areaSqm).toLocaleString()} m²)
        </div>
      )}
      {allowDrawing && (
        <div className="text-sm text-[var(--text-muted)]">
          Click the polygon tool to draw a zone boundary. Click existing polygons to edit or delete.
        </div>
      )}
    </div>
  );
}
