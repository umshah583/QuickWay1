import { prisma } from "@/lib/prisma";
import { Plus, Edit2, MapPin } from "lucide-react";
import Link from "next/link";
import DeleteAreaButton from "./DeleteAreaButton";

export const dynamic = "force-dynamic";

export default async function AreasPage() {
  const areas = await prisma.area.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: { servicePrices: true, bookings: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Service Areas</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Manage geographic zones for location-based pricing
          </p>
        </div>
        <Link
          href="/admin/areas/new"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
        >
          <Plus className="h-4 w-4" />
          Add Area
        </Link>
      </div>

      {areas.length === 0 ? (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
          <h3 className="mt-4 text-lg font-medium text-[var(--text-strong)]">No service areas yet</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Create service areas to enable location-based pricing
          </p>
          <Link
            href="/admin/areas/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Create First Area
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Area Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Coordinates (Bounding Box)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Price Multiplier
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Service Prices
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {areas.map((area) => (
                <tr key={area.id} className="hover:bg-[var(--surface-secondary)]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-[var(--text-strong)]">
                          {area.name}
                        </span>
                        {area.description && (
                          <p className="text-xs text-[var(--text-muted)]">{area.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-medium)] font-mono">
                    <div>Lat: {area.minLatitude.toFixed(4)} - {area.maxLatitude.toFixed(4)}</div>
                    <div>Lng: {area.minLongitude.toFixed(4)} - {area.maxLongitude.toFixed(4)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                      {area.priceMultiplier}x
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {area._count.servicePrices} prices
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        area.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {area.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/areas/${area.id}`}
                        className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--brand-primary)]"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <DeleteAreaButton
                        id={area.id}
                        name={area.name}
                        bookingsCount={area._count.bookings}
                      />
                    </div>
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
