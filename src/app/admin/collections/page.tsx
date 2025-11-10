import { format } from "date-fns";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BookingWithDriver = Prisma.BookingGetPayload<{
  include: {
    driver: true;
    service: true;
    user: true;
    payment: true;
  };
}>;

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function deriveIdentifiers(booking: BookingWithDriver) {
  const reference = booking.payment?.id?.trim() || booking.id;
  const shortId = reference.slice(-6).toUpperCase();
  const datePart = format(booking.startAt, "yyyyMMdd");
  const orderId = `ORD-${datePart}-${shortId}`;
  const invoiceNumber = `INV-${datePart}-${shortId}`;
  return { orderId, invoiceNumber };
}

export default async function AdminCollectionsPage() {
  const bookings = await prisma.booking.findMany({
    orderBy: { startAt: "desc" },
    include: {
      driver: true,
      service: true,
      user: true,
      payment: true,
    },
  }) as BookingWithDriver[];

  const collectedBookings = bookings.filter((booking: BookingWithDriver) => booking.cashCollected);

  if (collectedBookings.length === 0) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Collections</h1>
          <p className="text-sm text-[var(--text-muted)]">No completed cash collections yet.</p>
        </header>
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-8 text-center text-sm text-[var(--text-muted)]">
          Assign drivers to bookings to begin tracking cash collections.
        </div>
      </div>
    );
  }

  const driverSummaries = new Map<
    string,
    {
      name: string;
      email: string;
      jobs: number;
      collected: number;
      pending: number;
      lastJobDate?: Date;
    }
  >();

  let totalValueCents = 0;
  let totalCollectedCents = 0;

  for (const booking of collectedBookings) {
    const driverKey = booking.driver?.id ?? "unassigned";
    const driverName = booking.driver?.name || booking.driver?.email || "Unassigned";
    const driverEmail = booking.driver?.email ?? "";
    const serviceValue = booking.service?.priceCents ?? 0;

    totalValueCents += serviceValue;
    if (booking.cashCollected) {
      totalCollectedCents += booking.cashAmountCents ?? serviceValue;
    }

    if (!driverSummaries.has(driverKey)) {
      driverSummaries.set(driverKey, {
        name: driverName,
        email: driverEmail,
        jobs: 0,
        collected: 0,
        pending: 0,
        lastJobDate: undefined,
      });
    }

    const summary = driverSummaries.get(driverKey)!;
    summary.jobs += 1;
    if (booking.cashCollected) {
      summary.collected += booking.cashAmountCents ?? serviceValue;
    } else {
      summary.pending += serviceValue;
    }

    if (!summary.lastJobDate || booking.startAt > summary.lastJobDate) {
      summary.lastJobDate = booking.startAt;
    }
  }

  const driverSummaryList = Array.from(driverSummaries.entries()).map(([key, summary]) => ({
    key,
    ...summary,
  }));

  const totalPendingCents = 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Collections</h1>
          <p className="text-sm text-[var(--text-muted)]">Monitor cash collected by drivers and pending hand-ins.</p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center">
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5">
            Jobs: <strong className="text-[var(--text-strong)]">{collectedBookings.length}</strong>
          </span>
          <a
            href="/admin/collections/export"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
          >
            Download Excel
          </a>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Cash collected</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalCollectedCents)}</p>
          <p className="text-xs text-[var(--text-muted)]">Across all jobs with cash hand-ins recorded.</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Cash pending</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalPendingCents)}</p>
          <p className="text-xs text-[var(--text-muted)]">All pending amounts are excluded from collections.</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Average per job</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
            {formatCurrency(collectedBookings.length ? Math.round(totalValueCents / collectedBookings.length) : 0)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Mean service value per booking.</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total value</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalValueCents)}</p>
          <p className="text-xs text-[var(--text-muted)]">Sum of service prices.</p>
        </article>
      </section>

      <section className="space-y-3">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Driver collections</h2>
            <p className="text-xs text-[var(--text-muted)]">Summaries grouped by driver assignment.</p>
          </div>
        </header>
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Jobs</th>
                <th className="px-4 py-3 font-medium">Collected</th>
                <th className="px-4 py-3 font-medium">Pending</th>
                <th className="px-4 py-3 font-medium">Last job</th>
              </tr>
            </thead>
            <tbody>
              {driverSummaryList.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-[var(--text-muted)]" colSpan={5}>
                    No driver assignments.
                  </td>
                </tr>
              ) : (
                driverSummaryList.map((summary) => (
                  <tr key={summary.key} className="border-t border-[var(--surface-border)]">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-[var(--text-strong)]">{summary.name}</p>
                        {summary.email ? <p className="text-xs text-[var(--text-muted)]">{summary.email}</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{summary.jobs}</td>
                    <td className="px-4 py-3 font-medium text-emerald-600">{formatCurrency(summary.collected)}</td>
                    <td className="px-4 py-3 font-medium text-amber-600">{formatCurrency(summary.pending)}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {summary.lastJobDate ? format(summary.lastJobDate, "MMM d, yyyy • h:mm a") : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Collection details</h2>
            <p className="text-xs text-[var(--text-muted)]">Individual cash bookings with customer and driver data.</p>
          </div>
        </header>
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium text-right">Invoice</th>
                <th className="px-4 py-3 font-medium text-right">Collected</th>
                <th className="px-4 py-3 font-medium text-right">Pending</th>
              </tr>
            </thead>
            <tbody>
              {collectedBookings.map((booking: BookingWithDriver) => {
                const serviceValue = booking.service?.priceCents ?? 0;
                const collected = booking.cashCollected ? booking.cashAmountCents ?? serviceValue : 0;
                const pending = 0;
                const { orderId, invoiceNumber } = deriveIdentifiers(booking);

                return (
                  <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text-strong)]">{format(booking.startAt, "MMM d, yyyy")}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{orderId}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{invoiceNumber}</td>
                    <td className="px-4 py-3">
                      {booking.user ? (
                        <Link
                          href={`/admin/customers/${booking.user.id}`}
                          className="font-medium text-[var(--brand-primary)] hover:underline"
                        >
                          {booking.user.name || booking.user.email || "Customer"}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--text-muted)]">Guest</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="font-medium text-[var(--text-strong)]">
                          {booking.driver?.name || booking.driver?.email || "Unassigned"}
                        </p>
                        {booking.driver?.email ? (
                          <p className="text-xs text-[var(--text-muted)]">{booking.driver.email}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/admin/invoices/${booking.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-accent)]/30"
                      >
                        View invoice
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {formatCurrency(collected)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">
                      {formatCurrency(pending)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
