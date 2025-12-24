import Link from "next/link";
import { format } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "—";
  return format(date, "MMM d, yyyy • h:mm a");
}

function formatTimeOnly(date: Date | null | undefined) {
  if (!date) return "—";
  return format(date, "h:mm a");
}

function calculateDurationMinutes(start?: Date | null, end?: Date | null) {
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return null;
  return Math.round(diffMs / 60000);
}

type CompletedBookingItem = Prisma.BookingGetPayload<{
  include: {
    user: true;
    service: true;
    driver: true;
    payment: true;
  };
}> & {
  taskStartedAt: Date | null;
  taskCompletedAt: Date | null;
};

export default async function CompletedBookingsPage() {
  const bookings = (await prisma.booking.findMany({
    where: {
      status: "PAID",
      taskStatus: "COMPLETED",
    },
    orderBy: { startAt: "desc" },
    include: {
      user: true,
      service: true,
      driver: true,
      payment: true,
    },
  })) as CompletedBookingItem[];

  const totalValue = bookings.reduce((sum, booking) => {
    const amount = booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
    return sum + amount;
  }, 0);

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Completed orders</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Fully paid bookings marked as completed. Continue to reference or adjust details if necessary.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Total <strong className="ml-1 text-[var(--text-strong)]">{bookings.length}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Value <strong className="ml-1 text-[var(--text-strong)]">{formatCurrency(totalValue)}</strong>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-4 py-2 font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            ← Back to order management
          </Link>
        </div>
      </header>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-8 text-center text-sm text-[var(--text-muted)]">
          No completed bookings yet. Orders will appear here once marked paid and completed.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm">
          <table className="min-w-full divide-y divide-[var(--surface-border)] text-sm">
            <thead className="bg-[var(--background)]/60">
              <tr className="text-left text-[var(--text-muted)]">
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Driver</th>
                <th className="px-4 py-3 font-semibold">Timeline</th>
                <th className="px-4 py-3 font-semibold">Duration (min)</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {bookings.map((booking) => {
                const paymentStatus = booking.payment?.status ?? "PAID";
                const amount = booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
                const actualDuration = calculateDurationMinutes(booking.taskStartedAt ?? booking.startAt, booking.taskCompletedAt ?? booking.endAt);
                const scheduledDuration = booking.service?.durationMin ?? null;
                return (
                  <tr key={booking.id} className="hover:bg-[var(--brand-accent)]/15 transition">
                    <td className="px-4 py-3 font-medium text-[var(--text-strong)]">
                      <div className="flex flex-col">
                        <span>{booking.service?.name ?? "Service"}</span>
                        <span className="text-xs text-[var(--text-muted)]">#{booking.id.slice(-6)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--text-strong)]">{booking.user?.name ?? booking.user?.email ?? "Customer"}</span>
                        <span className="text-xs text-[var(--text-muted)]">{booking.user?.email ?? "No email"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <div className="flex flex-col">
                        <span>{booking.driver?.name ?? booking.driver?.email ?? "Driver"}</span>
                        <span className="text-xs text-[var(--text-muted)]">Completed task</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <div className="flex flex-col gap-1 text-xs">
                        <div>
                          <p className="font-semibold text-[var(--text-strong)]">Scheduled</p>
                          <p>{formatDateTime(booking.startAt)}</p>
                          <p className="text-[var(--text-muted)]">Ends {formatTimeOnly(booking.endAt)}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--text-strong)]">Actual</p>
                          <p>Started: {formatDateTime(booking.taskStartedAt ?? booking.startAt)}</p>
                          <p>Completed: {formatDateTime(booking.taskCompletedAt ?? booking.endAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col text-xs text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--text-strong)]">
                          Actual: {actualDuration ? `${actualDuration} min` : "—"}
                        </span>
                        <span>
                          Scheduled: {scheduledDuration ? `${scheduledDuration} min` : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-strong)]">{formatCurrency(amount)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                          aria-label={`Edit booking ${booking.id}`}
                          title="Edit order"
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                            <path d="M4.5 12.75L3.75 16.25 7.25 15.5 16.5 6.25 13.75 3.5 4.5 12.75Z" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 4.75L15.25 7.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
