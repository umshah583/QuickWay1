'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface AreaMapPickerProps {
  center: { lat: number; lng: number };
  radius: number;
  onCenterChange: (coords: { lat: number; lng: number }) => void;
}

export function AreaMapPicker({ center, radius, onCenterChange }: AreaMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);

  // Keep callback ref updated
  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Clear any existing Leaflet state on the container
    const container = containerRef.current;
    const containerWithLeaflet = container as HTMLDivElement & { _leaflet_id?: number };
    if (containerWithLeaflet._leaflet_id) {
      delete containerWithLeaflet._leaflet_id;
    }

    const map = L.map(container, {
      center: [center.lat, center.lng],
      zoom: 12,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Circle overlay
    const circle = L.circle([center.lat, center.lng], {
      radius: radius,
      color: '#7c3aed',
      fillOpacity: 0.15,
    }).addTo(map);

    // Draggable marker
    const markerIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    const marker = L.marker([center.lat, center.lng], {
      icon: markerIcon,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onCenterChangeRef.current({ lat: pos.lat, lng: pos.lng });
    });

    // Click handler
    map.on('click', (e: L.LeafletMouseEvent) => {
      onCenterChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Cleanup on unmount
    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once

  // Update marker and circle when center/radius change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;

    const latLng = L.latLng(center.lat, center.lng);
    markerRef.current.setLatLng(latLng);
    circleRef.current.setLatLng(latLng);
    circleRef.current.setRadius(radius);
  }, [center.lat, center.lng, radius]);

  return <div ref={containerRef} className="h-full w-full" />;
}
