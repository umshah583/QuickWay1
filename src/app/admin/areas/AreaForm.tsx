'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createArea, updateArea } from './actions';

const AreaMapPicker = dynamic(() => import('./AreaMapPicker').then((mod) => mod.AreaMapPicker), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--surface-secondary)] animate-pulse" />,
});

interface Area {
  id: string;
  name: string;
  description: string | null;
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  radiusMeters?: number | null;
  priceMultiplier: number;
  sortOrder: number;
  active: boolean;
}

interface AreaFormProps {
  area?: Area;
}

export default function AreaForm({ area }: AreaFormProps) {
  const action = area ? updateArea : createArea;
  const [error, formAction, isPending] = useActionState(
    async (_prevState: string | null, formData: FormData) => {
      try {
        await action(formData);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'An error occurred';
      }
    },
    null
  );

  const defaultCenter = useMemo(() => {
    if (area?.centerLatitude && area?.centerLongitude) {
      return {
        lat: area.centerLatitude,
        lng: area.centerLongitude,
      };
    }

    if (area) {
      return {
        lat: (area.minLatitude + area.maxLatitude) / 2,
        lng: (area.minLongitude + area.maxLongitude) / 2,
      };
    }

    return { lat: 25.2048, lng: 55.2708 }; // Default to Dubai
  }, [area]);

  const [center, setCenter] = useState(defaultCenter);
  const [radius, setRadius] = useState<number>(area?.radiusMeters ?? 1000);

  const formatBounds = (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => ({
    minLat: bounds.minLat.toFixed(6),
    maxLat: bounds.maxLat.toFixed(6),
    minLng: bounds.minLng.toFixed(6),
    maxLng: bounds.maxLng.toFixed(6),
  });

  const calculateBoundsFromCircle = (lat: number, lng: number, radiusMeters: number) => {
    const earthRadius = 6378137; // meters
    const latDelta = (radiusMeters / earthRadius) * (180 / Math.PI);
    const lngDelta = (radiusMeters / earthRadius) * (180 / Math.PI) / Math.cos((lat * Math.PI) / 180);
    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta,
    };
  };

  const [bounds, setBounds] = useState(() => {
    if (area) {
      return formatBounds({
        minLat: area.minLatitude,
        maxLat: area.maxLatitude,
        minLng: area.minLongitude,
        maxLng: area.maxLongitude,
      });
    }
    return formatBounds(calculateBoundsFromCircle(defaultCenter.lat, defaultCenter.lng, radius));
  });

  useEffect(() => {
    setBounds(formatBounds(calculateBoundsFromCircle(center.lat, center.lng, radius)));
  }, [center, radius]);

  const handleRadiusChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value) && value > 0) {
      setRadius(value);
    }
  };

  const handleCenterInputChange = (axis: 'lat' | 'lng', value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setCenter((prev) => ({
      ...prev,
      [axis === 'lat' ? 'lat' : 'lng']: numeric,
    }));
  };

  return (
    <form action={formAction} className="space-y-6">
      {area && <input type="hidden" name="id" value={area.id} />}
      <input type="hidden" name="centerLatitude" value={center.lat} />
      <input type="hidden" name="centerLongitude" value={center.lng} />
      <input type="hidden" name="radiusMeters" value={radius} />

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-strong)] mb-4">Basic Information</h2>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-[var(--text-medium)]">
              Area Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={area?.name ?? ''}
              placeholder="e.g., Downtown Dubai, Marina, JLT"
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-[var(--text-medium)]">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={area?.description ?? ''}
              placeholder="Optional description for this area"
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Map & Radius</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Click on the map to set the area center. Adjust the radius to cover the desired zone.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="radiusMeters" className="text-sm font-medium text-[var(--text-medium)]">
              Radius (meters)
            </label>
            <input
              id="radiusMeters"
              type="number"
              min={100}
              step={50}
              value={radius}
              onChange={handleRadiusChange}
              className="w-32 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="h-96 overflow-hidden rounded-xl border border-[var(--surface-border)]">
          <AreaMapPicker center={center} radius={radius} onCenterChange={setCenter} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[var(--text-medium)]">
              Center Latitude
            </label>
            <input
              type="number"
              step="any"
              value={center.lat}
              onChange={(event) => handleCenterInputChange('lat', event.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-medium)]">
              Center Longitude
            </label>
            <input
              type="number"
              step="any"
              value={center.lng}
              onChange={(event) => handleCenterInputChange('lng', event.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
            />
          </div>
        </div>

      </div>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-strong)] mb-4">Geographic Boundaries</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Auto-generated from the selected center and radius. These values are read-only snapshots used for quick filtering.
        </p>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="minLatitude" className="block text-sm font-medium text-[var(--text-medium)]">
              Min Latitude (South) *
            </label>
            <input
              type="number"
              id="minLatitude"
              name="minLatitude"
              required
              step="any"
              value={bounds.minLat}
              readOnly
              placeholder="e.g., 25.0"
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label htmlFor="maxLatitude" className="block text-sm font-medium text-[var(--text-medium)]">
              Max Latitude (North) *
            </label>
            <input
              type="number"
              id="maxLatitude"
              name="maxLatitude"
              required
              step="any"
              value={bounds.maxLat}
              readOnly
              placeholder="e.g., 25.3"
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label htmlFor="minLongitude" className="block text-sm font-medium text-[var(--text-medium)]">
              Min Longitude (West) *
            </label>
            <input
              type="number"
              id="minLongitude"
              name="minLongitude"
              required
              step="any"
              value={bounds.minLng}
              readOnly
              placeholder="e.g., 55.1"
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label htmlFor="maxLongitude" className="block text-sm font-medium text-[var(--text-medium)]">
              Max Longitude (East) *
            </label>
            <input
              type="number"
              id="maxLongitude"
              name="maxLongitude"
              required
              step="any"
              value={bounds.maxLng}
              readOnly
              placeholder="e.g., 55.4"
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-strong)] mb-4">Pricing & Settings</h2>
        
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="priceMultiplier" className="block text-sm font-medium text-[var(--text-medium)]">
              Price Multiplier
            </label>
            <input
              type="number"
              id="priceMultiplier"
              name="priceMultiplier"
              step="0.01"
              min="0.1"
              max="10"
              defaultValue={area?.priceMultiplier ?? 1.0}
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              1.0 = standard price, 1.5 = 50% more
            </p>
          </div>

          <div>
            <label htmlFor="sortOrder" className="block text-sm font-medium text-[var(--text-medium)]">
              Sort Order
            </label>
            <input
              type="number"
              id="sortOrder"
              name="sortOrder"
              min="0"
              defaultValue={area?.sortOrder ?? 0}
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div className="flex items-center pt-6">
            <input
              type="checkbox"
              id="active"
              name="active"
              defaultChecked={area?.active ?? true}
              className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
            />
            <label htmlFor="active" className="ml-2 text-sm font-medium text-[var(--text-medium)]">
              Active
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Link
          href="/admin/areas"
          className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          {isPending ? 'Saving...' : area ? 'Update Area' : 'Create Area'}
        </button>
      </div>
    </form>
  );
}
