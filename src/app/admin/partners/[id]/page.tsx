import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPartnerFinancialSnapshot, countActiveJobs, countCompletedJobs, getBookingGrossValue } from "../financials";
import PartnerPayoutForm from "../PartnerPayoutForm";

export const dynamic = "force-dynamic";

type AdminPartnerPageProps = {
  params: Promise<{ id: string }>;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

export default async function AdminPartnerDetailPage({ params }: AdminPartnerPageProps) {
  const { id } = await params;

  const isValidObjectId = /^[a-f\d]{24}$/i;
  if (!isValidObjectId.test(id)) {
    notFound();
  }

  const snapshot = await loadPartnerFinancialSnapshot(id);

  if (!snapshot) {
    notFound();
  }

  const {
    partner,
    combinedBookings,
    commissionPercentage,
    totals,
    payouts,
    totalPayoutsCents,
    outstandingCents,
    monthlyPayouts,
  } = snapshot;
  const commissionMultiplier = Math.max(0, Math.min(commissionPercentage, 100)) / 100;

  const activeJobCount = countActiveJobs(combinedBookings);
  const completedJobCount = countCompletedJobs(combinedBookings);
  const netAfterPayouts = Math.max(0, totals.totalNet - totalPayoutsCents);

  const driversWithActivity = partner.drivers.map((driver) => {
    const ongoing = driver.driverBookings.filter((booking) => booking.taskStatus !== "COMPLETED");
    const completed = driver.driverBookings.filter((booking) => booking.taskStatus === "COMPLETED");
    const latest = driver.driverBookings[0];
    const earnings = driver.driverBookings.reduce((sum, booking) => {
      const value = booking.cashCollected ? booking.cashAmountCents ?? booking.service?.priceCents ?? 0 : 0;
      return sum + value;
    }, 0);
    return {
      id: driver.id,
      name: driver.name ?? driver.email ?? "Driver",
      email: driver.email ?? "—",
      ongoingCount: ongoing.length,
      completedCount: completed.length,
      latestAt: latest?.startAt ?? null,
      earnings,
    };
  });

  const recentBookings = combinedBookings
    .slice()
    .sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Partner overview</p>
            <h1 className="text-3xl font-semibold text-[var(--text-strong)]">{partner.name}</h1>
            <p className="text-sm text-[var(--text-muted)]">{partner.email ?? "No email registered"}</p>
          </div>
          <Link
            href="/admin/partners"
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            Back to partners
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total drivers</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{partner.drivers.length}</p>
          </article>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Active jobs</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activeJobCount}</p>
          </article>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Completed jobs</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{completedJobCount}</p>
          </article>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Outstanding earnings</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(outstandingCents)}</p>
            <p className="text-xs text-[var(--text-muted)]">Net earnings after payouts</p>
          </article>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Record payout</h2>
              <p className="text-xs text-[var(--text-muted)]">Log partial payouts to settle partner earnings.</p>
            </div>
            <div className="text-right text-sm text-[var(--text-muted)]">
              <p>Net earnings outstanding</p>
              <p className="text-base font-semibold text-[var(--text-strong)]">{formatCurrency(netAfterPayouts)}</p>
            </div>
          </header>
          <PartnerPayoutForm partnerId={partner.id} outstandingCents={outstandingCents} />
        </article>

        <article className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Monthly payout history</h2>
              <p className="text-xs text-[var(--text-muted)]">Totals grouped by calendar month.</p>
            </div>
          </header>
          <div className="overflow-hidden rounded-xl border border-[var(--surface-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                <tr className="text-xs uppercase tracking-[0.16em]">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Payouts</th>
                  <th className="px-4 py-3 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {monthlyPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                      No payouts recorded yet.
                    </td>
                  </tr>
                ) : (
                  monthlyPayouts.map((row) => {
                    const monthLabel = format(new Date(row.year, row.month - 1, 1), "MMM yyyy");
                    return (
                      <tr key={`${row.year}-${row.month}`} className="border-t border-[var(--surface-border)]">
                        <td className="px-4 py-3 text-[var(--text-strong)]">{monthLabel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--text-strong)]">
                          {formatCurrency(row.totalCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--text-muted)]">{row.count}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Payout activity</h2>
            <p className="text-xs text-[var(--text-muted)]">Detailed log of individual payouts.</p>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Total paid: <span className="font-semibold text-[var(--text-strong)]">{formatCurrency(totals.totalNet - outstandingCents)}</span>
          </p>
        </header>
        <div className="overflow-hidden rounded-xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr className="text-xs uppercase tracking-[0.16em]">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Recorded by</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No payouts logged yet.
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="border-t border-[var(--surface-border)]">
                    <td className="px-4 py-3 text-[var(--text-strong)]">{format(payout.createdAt, "d MMM yyyy, h:mma")}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-strong)]">{formatCurrency(payout.amountCents)}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {payout.createdByAdmin?.name ?? payout.createdByAdmin?.email ?? "Admin"}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{payout.note ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Driver roster</h2>
          <p className="text-xs text-[var(--text-muted)]">Latest activity and earning summary for each partner driver.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr className="text-xs uppercase tracking-[0.16em]">
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Active jobs</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Earned</th>
                <th className="px-4 py-3">Last assignment</th>
              </tr>
            </thead>
            <tbody>
              {driversWithActivity.map((driver) => (
                <tr key={driver.id} className="border-t border-[var(--surface-border)]">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--text-strong)]">{driver.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{driver.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-strong)]">{driver.ongoingCount}</td>
                  <td className="px-4 py-3 text-[var(--text-strong)]">{driver.completedCount}</td>
                  <td className="px-4 py-3 text-[var(--text-strong)]">{formatCurrency(driver.earnings)}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {driver.latestAt ? formatDistanceToNow(driver.latestAt, { addSuffix: true }) : "No assignments"}
                  </td>
                </tr>
              ))}
              {driversWithActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No drivers linked to this partner yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Recent jobs</h2>
          <p className="text-xs text-[var(--text-muted)]">Most recent bookings assigned to partner drivers.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr className="text-xs uppercase tracking-[0.16em]">
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Collected</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((booking) => {
                const isPaid = booking.payment?.status === "PAID" || booking.cashCollected;
                const gross = getBookingGrossValue(booking);
                const value = Math.round(gross * commissionMultiplier);
                return (
                  <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                    <td className="px-4 py-3 text-[var(--text-muted)]">#{booking.id.slice(-6)}</td>
                    <td className="px-4 py-3 text-[var(--text-strong)]">{booking.service?.name ?? "Service"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[var(--brand-accent)]/30 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">{booking.taskStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{format(booking.startAt, "MMM d, h:mm a")}</td>
                    <td className="px-4 py-3 text-[var(--text-strong)]">{isPaid ? formatCurrency(value) : "Pending"}</td>
                  </tr>
                );
              })}
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No bookings recorded for this partner yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
