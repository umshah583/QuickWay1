'use client';

import { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapDriver {
  driverId: string;
  driverName: string;
  phoneNumber: string | null;
  availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ON_BREAK';
  currentTaskStatus: string | null;
  location: {
    latitude: number | null;
    longitude: number | null;
    updatedAt: Date | null;
  } | null;
  lastSeen: Date;
  taskCount: number;
}

interface LiveTrackingMapProps {
  drivers: MapDriver[];
}

function formatTimeAgo(date: Date | string | null) {
  if (!date) return 'Unknown';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  return `${Math.floor(diffInSeconds / 3600)}h ago`;
}

export default function LiveTrackingMap({ drivers }: LiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // If map already exists, don't reinitialize
    if (mapInstanceRef.current) return;

    // Create new map instance
    const map = L.map(mapContainerRef.current).setView([25.2048, 55.2708], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when drivers change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    console.log('[LiveTrackingMap] Received drivers:', drivers);

    // Collect all valid coordinates for bounds fitting
    const validCoords: [number, number][] = [];

    // Add new markers
    drivers.forEach(driver => {
      console.log(`[LiveTrackingMap] Processing driver ${driver.driverName}:`, {
        hasLocation: !!driver.location,
        latitude: driver.location?.latitude,
        longitude: driver.location?.longitude,
        status: driver.availabilityStatus
      });

      if (!driver.location || !driver.location.latitude || !driver.location.longitude) {
        console.log(`[LiveTrackingMap] Skipping driver ${driver.driverName} - no valid location`);
        return;
      }
      
      const lat = driver.location.latitude;
      const lng = driver.location.longitude;
      
      console.log(`[LiveTrackingMap] Adding marker for ${driver.driverName} at [${lat}, ${lng}]`);

      // Create custom icon based on status
      const iconColor = driver.availabilityStatus === 'AVAILABLE' ? 'green' : 
                        driver.availabilityStatus === 'BUSY' ? 'orange' : 'red';
      
      const customIcon = L.divIcon({
        className: 'custom-driver-marker',
        html: `<div style="
          width: 30px; 
          height: 30px; 
          background-color: ${iconColor}; 
          border-radius: 50%; 
          border: 3px solid white; 
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
        ">${driver.driverName.charAt(0).toUpperCase()}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(mapInstanceRef.current!)
        .bindPopup(`
          <div style="padding: 8px; font-size: 14px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${driver.driverName}</div>
            <div style="color: #666; margin-bottom: 2px;">Status: ${driver.availabilityStatus}</div>
            <div style="color: #666; margin-bottom: 2px;">Tasks: ${driver.taskCount}</div>
            ${driver.currentTaskStatus ? `<div style="color: #666; margin-bottom: 2px;">Current: ${driver.currentTaskStatus}</div>` : ''}
            <div style="color: #666; font-size: 12px;">Updated: ${formatTimeAgo(driver.location.updatedAt)}</div>
            <div style="color: #888; font-size: 11px; margin-top: 4px;">📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
          </div>
        `);
      markersRef.current.push(marker);
      validCoords.push([lat, lng]);
    });

    console.log(`[LiveTrackingMap] Added ${markersRef.current.length} markers`);

    // Auto-fit map to show all markers
    if (validCoords.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(validCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      console.log(`[LiveTrackingMap] Fitted bounds to show ${validCoords.length} markers`);
    }
  }, [drivers]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ height: '500px', width: '100%', borderRadius: '8px' }}
    />
  );
}
