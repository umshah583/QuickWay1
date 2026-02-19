import Link from 'next/link';
import { MapPin, Plus } from 'lucide-react';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type ZoneListRow = {
  id: string;
  name: string;
  description: string | null;
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  radiusMeters: number | null;
  priceMultiplier: number;
  active: boolean;
  updatedAt: Date;
  polygonJson: string | null;
};

async function fetchZones(): Promise<ZoneListRow[]> {
  const rows = await prisma.area.findMany({
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      description: true,
      minLatitude: true,
      maxLatitude: true,
      minLongitude: true,
      maxLongitude: true,
      radiusMeters: true,
      priceMultiplier: true,
      active: true,
      updatedAt: true,
      polygonJson: true,
    },
  });
  return rows;
}

function formatBounds(zone: ZoneListRow): string {
  const latRange = `${zone.minLatitude.toFixed(4)} – ${zone.maxLatitude.toFixed(4)}`;
  const lngRange = `${zone.minLongitude.toFixed(4)} – ${zone.maxLongitude.toFixed(4)}`;
  return `Lat ${latRange}\nLng ${lngRange}`;
}

export default async function ZonesPage() {
  const zones = await fetchZones();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">GPS Pricing Zones</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Manage polygon-based service areas used for zone pricing and lookups.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action="/admin/zones" className="hidden" />
          <Link
            href="/admin/zones/new"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
          >
            <Plus className="h-4 w-4" />
            New Zone
          </Link>
        </div>
      </div>

      {zones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)] p-10 text-center">
          <MapPin className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
          <h3 className="mt-4 text-lg font-semibold text-[var(--text-strong)]">No GPS zones yet</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Create at least one polygon to enable GPS-based pricing.
          </p>
          <Link
            href="/admin/zones/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Create the first zone
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)] text-[var(--text-label)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Zone</th>
                <th className="px-4 py-3 text-left font-medium">Bounds</th>
                <th className="px-4 py-3 text-left font-medium">Radius</th>
                <th className="px-4 py-3 text-left font-medium">Multiplier</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {zones.map((zone) => (
                <tr key={zone.id} className="hover:bg-[var(--surface-secondary)]/40">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[var(--text-strong)] font-medium">{zone.name}</span>
                      {zone.description && (
                        <span className="text-xs text-[var(--text-medium)]">{zone.description}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-pre text-xs text-[var(--text-medium)]">{formatBounds(zone)}</td>
                  <td className="px-4 py-3">
                    {zone.radiusMeters ? `${Math.round(zone.radiusMeters).toLocaleString()} m` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                      {zone.priceMultiplier.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        zone.active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {zone.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-medium)]">
                    {new Date(zone.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/zones/${zone.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
