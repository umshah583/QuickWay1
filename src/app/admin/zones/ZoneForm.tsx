'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Info, Shuffle } from 'lucide-react';

import { createZone, updateZone } from './actions';
import { ZonePolygonPreview } from './ZonePolygonPreview';

type ServerAction = (prevState: string | null, formData: FormData) => Promise<void>;

export type ZoneFormData = {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  polygonJson: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

interface ZoneFormProps {
  zone?: ZoneFormData;
}

const DEFAULT_POLYGON = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [55.2708, 25.2048],
      [55.2808, 25.2048],
      [55.2808, 25.2148],
      [55.2708, 25.2148],
      [55.2708, 25.2048],
    ],
  ],
};

export function ZoneForm({ zone }: ZoneFormProps) {
  const action: ServerAction = zone ? updateZone : createZone;

  const [polygonInput, setPolygonInput] = useState(
    () => JSON.stringify(zone?.polygonJson ?? DEFAULT_POLYGON, null, 2)
  );
  const [metadataInput, setMetadataInput] = useState(
    () => JSON.stringify(zone?.metadata ?? { tags: ['residential'] }, null, 2)
  );
  const [polygonPreview, setPolygonPreview] = useState<{ type: string; coordinates: number[][][] } | null>(zone?.polygonJson as { type: string; coordinates: number[][][] } | null ?? DEFAULT_POLYGON);
  const [polygonError, setPolygonError] = useState<string | null>(null);

  useEffect(() => {
    if (!polygonInput.trim()) {
      setPolygonPreview(null);
      setPolygonError('Polygon GeoJSON is required');
      return;
    }
    try {
      const parsed = JSON.parse(polygonInput);
      setPolygonPreview(parsed);
      setPolygonError(null);
    } catch {
      setPolygonPreview(null);
      setPolygonError('Invalid GeoJSON polygon');
    }
  }, [polygonInput]);

  const [errorMessage, formAction, isPending] = useActionState(async (_prev: string | null, formData: FormData) => {
    try {
      // Ensure the latest editor values are submitted
      formData.set('polygonGeoJson', polygonInput);
      formData.set('metadata', metadataInput);
      await action(_prev, formData);
      return null;
    } catch (error) {
      if (error && typeof error === 'object' && 'digest' in error) {
        throw error;
      }
      return error instanceof Error ? error.message : 'Failed to save zone';
    }
  }, null);

  const headerTitle = zone ? `Edit Zone: ${zone.name}` : 'Create GPS Zone';
  const headerSubtitle = zone
    ? 'Update polygon, metadata, and pricing priority'
    : 'Define a new polygonal zone for GPS pricing';

  const prettyPolygon = useMemo(() => polygonInput, [polygonInput]);
  const prettyMetadata = useMemo(() => metadataInput, [metadataInput]);

  const handlePolygonShuffle = (event: FormEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const latOffset = (Math.random() - 0.5) * 0.01;
    const lngOffset = (Math.random() - 0.5) * 0.01;
    const shuffled = {
      ...DEFAULT_POLYGON,
      coordinates: [
        DEFAULT_POLYGON.coordinates[0].map(([lng, lat]) => [lng + lngOffset, lat + latOffset]),
      ],
    };
    setPolygonInput(JSON.stringify(shuffled, null, 2));
  };

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-strong)]">{headerTitle}</h2>
          <p className="text-sm text-[var(--text-muted)]">{headerSubtitle}</p>
        </div>
        <Link
          href="/admin/zones"
          className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
        >
          Back to list
        </Link>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {zone && <input type="hidden" name="id" value={zone.id} />}

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[var(--text-medium)]" htmlFor="code">
              Zone Code *
            </label>
            <input
              id="code"
              name="code"
              required
              defaultValue={zone?.code ?? ''}
              placeholder="DXB01, AUH02"
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm uppercase"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-medium)]" htmlFor="priority">
              Priority
            </label>
            <input
              id="priority"
              name="priority"
              type="number"
              defaultValue={zone?.priority ?? 0}
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[var(--text-medium)]" htmlFor="name">
              Display Name *
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={zone?.name ?? ''}
              placeholder="Dubai Marina"
              className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={zone?.isActive ?? true}
              className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-[var(--text-medium)]">
              Active zone
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--text-medium)]" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            defaultValue={zone?.description ?? ''}
            placeholder="Business district, high-demand area, etc."
            className="mt-1 block w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">Polygon GeoJSON</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Paste a GeoJSON polygon. Coordinates should be [[lng, lat], ...]
            </p>
          </div>
          <button
            onClick={handlePolygonShuffle}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-medium)]"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Sample Polygon
          </button>
        </div>

        <textarea
          name="polygonGeoJson"
          rows={10}
          value={prettyPolygon}
          onChange={(event) => setPolygonInput(event.target.value)}
          className="font-mono text-xs mt-2 block w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2"
        />

        {polygonError ? (
          <p className="text-sm text-red-600">{polygonError}</p>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--surface-border)] p-3 text-xs text-[var(--text-muted)]">
            <p className="flex items-center gap-2">
              <Info className="h-4 w-4" /> Polygon parsed successfully. Preview below.
            </p>
          </div>
        )}

        <ZonePolygonPreview polygon={polygonPreview} />
      </div>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[var(--text-strong)]">Metadata (optional)</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Attach arbitrary JSON metadata (driver notes, coverage labels, etc.)
        </p>
        <textarea
          name="metadata"
          rows={6}
          value={prettyMetadata}
          onChange={(event) => setMetadataInput(event.target.value)}
          className="font-mono text-xs mt-2 block w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/admin/zones"
          className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || !!polygonError}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          {isPending ? 'Saving…' : zone ? 'Update Zone' : 'Create Zone'}
        </button>
      </div>
    </form>
  );
}
