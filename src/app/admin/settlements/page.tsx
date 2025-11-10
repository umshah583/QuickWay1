import Link from "next/link";
import { format } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { settleDriverCollections } from "./actions";

export const dynamic = "force-dynamic";

type SettlementRow = {
  driverId: string | null;
  driverName: string;
  driverEmail: string;
  jobs: number;
  outstandingCents: number;
  settledCents: number;
  totalCents: number;
  lastCollection?: Date;
};

type BookingWithDriver = Prisma.BookingGetPayload<{
  include: {
    driver: true;
    service: { select: { priceCents: true } };
  };
}>;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

export default async function AdminSettlementsPage() {
  const bookings = await prisma.booking.findMany({
    where: { cashCollected: true },
    orderBy: { startAt: "desc" },
    include: {
      driver: true,
      service: { select: { priceCents: true } },
    },
  }) as BookingWithDriver[];

  if (bookings.length === 0) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Settlements</h1>
          <p className="text-sm text-[var(--text-muted)]">No cash collections have been recorded yet.</p>
        </header>
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-8 text-center text-sm text-[var(--text-muted)]">
          Once drivers submit cash collections, they will appear here for reconciliation.
        </div>
      </div>
    );
  }

  const settlementMap = new Map<string, SettlementRow>();

  for (const booking of bookings) {
    const driverKey = booking.driver?.id ?? "unassigned";
    const existing = settlementMap.get(driverKey);
    const bookingValue = booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
    const isSettled = booking.cashSettled;

    if (!existing) {
      settlementMap.set(driverKey, {
        driverId: booking.driver?.id ?? null,
        driverName: booking.driver?.name || booking.driver?.email || "Unassigned",
        driverEmail: booking.driver?.email ?? "",
        jobs: 1,
        outstandingCents: isSettled ? 0 : bookingValue,
        settledCents: isSettled ? bookingValue : 0,
        totalCents: bookingValue,
        lastCollection: booking.startAt,
      });
    } else {
      existing.jobs += 1;
      existing.totalCents += bookingValue;
      if (isSettled) {
        existing.settledCents += bookingValue;
      } else {
        existing.outstandingCents += bookingValue;
      }
      if (!existing.lastCollection || booking.startAt > existing.lastCollection) {
        existing.lastCollection = booking.startAt;
      }
    }
  }

  const settlements = Array.from(settlementMap.values()).sort((a, b) => (b.outstandingCents ?? 0) - (a.outstandingCents ?? 0));
  const totalOutstanding = settlements.reduce((sum: number, row: SettlementRow) => sum + row.outstandingCents, 0);
  const totalSettled = settlements.reduce((sum: number, row: SettlementRow) => sum + row.settledCents, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Settlements</h1>
          <p className="text-sm text-[var(--text-muted)]">Track driver cash balances and clear outstanding payouts.</p>
        </div>
        <div className="flex gap-3 text-sm text-[var(--text-muted)]">
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5">
            Drivers: <strong className="text-[var(--text-strong)]">{settlements.length}</strong>
          </span>
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5">
            Outstanding: <strong className="text-[var(--text-strong)]">{formatCurrency(totalOutstanding)}</strong>
          </span>
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5">
            Settled: <strong className="text-[var(--text-strong)]">{formatCurrency(totalSettled)}</strong>
          </span>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Driver</th>
              <th className="px-4 py-3 font-medium">Jobs</th>
              <th className="px-4 py-3 font-medium text-right">Outstanding</th>
              <th className="px-4 py-3 font-medium text-right">Settled</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium text-right">Last collection</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((row) => (
              <tr key={row.driverId ?? row.driverName} className="border-t border-[var(--surface-border)]">
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <p className="font-medium text-[var(--text-strong)]">{row.driverName}</p>
                    {row.driverEmail ? <p className="text-xs text-[var(--text-muted)]">{row.driverEmail}</p> : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{row.jobs}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-600">{formatCurrency(row.outstandingCents)}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(row.settledCents)}</td>
                <td className="px-4 py-3 text-right font-semibold text-[var(--text-strong)]">{formatCurrency(row.totalCents)}</td>
                <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                  {row.lastCollection ? format(row.lastCollection, "MMM d, yyyy • h:mm a") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.driverId ? (
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/collections?driver=${row.driverId}`}
                        className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                      >
                        View collections
                      </Link>
                      {row.outstandingCents > 0 ? (
                        <form action={settleDriverCollections}>
                          <input type="hidden" name="driverId" value={row.driverId} />
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                          >
                            Mark settled
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">Fully settled</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">Assign driver</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
