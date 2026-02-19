import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Pencil, Trash2 } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { PolygonEditor } from './PolygonEditor';
import { upsertServiceAreaPrice, deleteServiceAreaPrice } from '../pricing-actions';

export const dynamic = 'force-dynamic';

function formatCurrency(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || Number.isNaN(cents)) {
    return '—';
  }
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(cents / 100);
}

type ZoneDetailParams = { id?: string };

function formatBounds(latMin: number, latMax: number, lngMin: number, lngMax: number) {
  return {
    lat: `${latMin.toFixed(4)} – ${latMax.toFixed(4)}`,
    lng: `${lngMin.toFixed(4)} – ${lngMax.toFixed(4)}`,
  };
}

async function resolveParams(params: ZoneDetailParams | Promise<ZoneDetailParams> | undefined) {
  if (!params) {
    return {} as ZoneDetailParams;
  }
  if (typeof (params as Promise<ZoneDetailParams>).then === 'function') {
    return params as Promise<ZoneDetailParams>;
  }
  return params as ZoneDetailParams;
}

export default async function ZoneDetailPage({ params }: { params?: ZoneDetailParams | Promise<ZoneDetailParams> }) {
  const resolvedParams = await resolveParams(params);
  const id = resolvedParams.id;

  if (!id) {
    notFound();
  }

  const area = await prisma.area.findUnique({
    where: { id },
    include: {
      servicePrices: true,
    },
  });

  if (!area) {
    notFound();
  }

  const services = await prisma.service.findMany({
    orderBy: { name: 'asc' },
  });

  const bounds = formatBounds(area.minLatitude, area.maxLatitude, area.minLongitude, area.maxLongitude);
  const polygonJson = area.polygonJson ? JSON.parse(area.polygonJson) : null;
  const priceLookup = new Map(area.servicePrices.map((price) => [price.serviceId, price]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/zones"
          className="rounded-full border border-[var(--surface-border)] p-2 text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--text-label)]">GPS Zone</p>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">{area.name}</h1>
          {area.description && <p className="text-sm text-[var(--text-muted)]">{area.description}</p>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Zone Polygon Editor</h2>
              <p className="text-sm text-[var(--text-muted)]">Draw or edit the zone boundary on the map below.</p>
            </div>
            <Link
              href={`/admin/areas/${area.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Metadata
            </Link>
          </div>
          <div className="mt-4">
            <PolygonEditor areaId={area.id} initialPolygon={polygonJson} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">Zone Details</h3>
            <dl className="mt-4 space-y-3 text-sm text-[var(--text-medium)]">
              <div>
                <dt className="text-[var(--text-muted)]">Latitude</dt>
                <dd className="font-mono">{bounds.lat}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Longitude</dt>
                <dd className="font-mono">{bounds.lng}</dd>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <dt className="text-[var(--text-muted)]">Radius</dt>
                  <dd>{area.radiusMeters ? `${Math.round(area.radiusMeters).toLocaleString()} m` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Multiplier</dt>
                  <dd className="font-semibold text-[var(--text-strong)]">{area.priceMultiplier.toFixed(2)}x</dd>
                </div>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Status</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      area.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {area.active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">Quick Actions</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Link
                href={`/admin/areas/${area.id}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Zone Metadata
              </Link>
              <Link
                href="/admin/services"
                className="flex items-center gap-2 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
              >
                <MapPin className="h-3.5 w-3.5" /> Manage Services
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Zone Pricing Overrides</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Set per-service prices for this zone. Leave empty to fall back to global price and multiplier.
            </p>
          </div>
          <div className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs text-[var(--text-muted)]">
            {priceLookup.size} overrides
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-[var(--surface-border)] text-[var(--text-label)]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Service</th>
                <th className="px-3 py-2 text-left font-medium">Base Price</th>
                <th className="px-3 py-2 text-left font-medium">Zone Override</th>
                <th className="px-3 py-2 text-left font-medium">Discount %</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {services.map((service) => {
                const override = priceLookup.get(service.id);
                return (
                  <tr key={service.id}>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-[var(--text-strong)]">{service.name}</div>
                      {service.description && (
                        <div className="text-xs text-[var(--text-muted)]">{service.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">{formatCurrency(service.priceCents)}</td>
                    <td className="px-3 py-3">
                      <form action={upsertServiceAreaPrice} className="flex items-center gap-2">
                        <input type="hidden" name="areaId" value={area.id} />
                        <input type="hidden" name="serviceId" value={service.id} />
                        {override ? (
                          <input type="hidden" name="existingPriceCents" value={override.priceCents} />
                        ) : null}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="price"
                          defaultValue={override ? (override.priceCents / 100).toFixed(2) : ''}
                          placeholder="e.g. 150"
                          className="w-28 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          name="discount"
                          defaultValue={override?.discountPercentage ?? ''}
                          placeholder="%"
                          className="w-16 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-sm"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-secondary)]"
                        >
                          {override ? 'Update' : 'Set'}
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3">
                      {override?.discountPercentage ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {override ? (
                        <form action={deleteServiceAreaPrice}>
                          <input type="hidden" name="areaId" value={area.id} />
                          <input type="hidden" name="serviceId" value={service.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">Using global pricing</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
