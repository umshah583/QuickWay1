import Link from "next/link";
import { format } from "date-fns";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireDriverSession } from "@/lib/driver-auth";
import { startTask, completeTask, submitCashDetails } from "./actions";

export const dynamic = "force-dynamic";

type DriverBookingItem = Prisma.BookingGetPayload<{
  include: {
    service: true;
    user: true;
    payment: true;
  };
}> & {
  locationLabel: string | null;
  locationCoordinates: string | null;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

export default async function DriverDashboardPage() {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;

  const now = new Date();
  const lookback = new Date(now);
  lookback.setDate(lookback.getDate() - 1);
  lookback.setHours(0, 0, 0, 0);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);

  const bookings = await prisma.booking.findMany({
    where: {
      driverId,
      OR: [
        {
          startAt: {
            gte: lookback,
            lt: horizon,
          },
        },
        {
          taskStatus: {
            not: "COMPLETED",
          },
        },
      ],
    },
    include: {
      service: true,
      user: true,
      payment: true,
    },
    orderBy: { startAt: "asc" },
  }) as DriverBookingItem[];

  const activeBookings = bookings.filter((booking: DriverBookingItem) => !(booking.taskStatus === "COMPLETED" && booking.cashCollected));

  const totalJobs = bookings.length;
  const activeJobs = activeBookings.length;
  const totalValueCents = bookings.reduce(
    (sum: number, booking: DriverBookingItem) => sum + (booking.service?.priceCents ?? 0),
    0,
  );
  const collectedCents = bookings
    .filter((booking: DriverBookingItem) => booking.cashCollected)
    .reduce(
      (sum: number, booking: DriverBookingItem) => sum + (booking.cashAmountCents ?? booking.service?.priceCents ?? 0),
      0,
    );
  const pendingCents = Math.max(totalValueCents - collectedCents, 0);
  const collectedCount = bookings.filter((booking: DriverBookingItem) => booking.cashCollected).length;

  if (bookings.length === 0) {
    return (
      <div className="space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Today&apos;s tasks</h1>
          <p className="text-sm text-[var(--text-muted)]">You&apos;re all caught up. Check back later for new assignments.</p>
        </header>
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-8 text-center text-sm text-[var(--text-muted)]">
          No bookings assigned for today yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Assigned jobs</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{totalJobs}</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Active jobs</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activeJobs}</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Cash collected</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(collectedCents)}</p>
          <p className="text-xs text-[var(--text-muted)]">{collectedCount} job(s) paid</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Cash pending</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(pendingCents)}</p>
          <p className="text-xs text-[var(--text-muted)]">{totalJobs - collectedCount} job(s) remaining</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total value</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalValueCents)}</p>
        </article>
      </section>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Today&apos;s tasks</h1>
        <p className="text-sm text-[var(--text-muted)]">Review each booking and update the status as you progress.</p>
      </header>

      <div className="grid gap-4">
        {activeBookings.map((booking: DriverBookingItem) => {
          const paymentStatus = booking.payment?.status ?? "REQUIRES_PAYMENT";
          return (
            <article key={booking.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
              <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">{booking.service?.name ?? "Service"}</div>
                  <h2 className="text-lg font-semibold">
                    <time dateTime={booking.startAt.toISOString()} suppressHydrationWarning>
                      {format(booking.startAt, "EEE, MMM d • h:mm a")}
                    </time>
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">Customer: {booking.user?.email ?? "Guest"}</p>
                  {booking.taskStatus === "COMPLETED" ? (
                    <Link
                      href={`/driver/invoices/${booking.id}`}
                      className="mt-2 inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                    >
                      View invoice
                    </Link>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Task: {booking.taskStatus}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Booking: {booking.status}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Payment: {paymentStatus}</span>
                  {booking.locationCoordinates && (booking.taskStatus === "IN_PROGRESS" || booking.taskStatus === "COMPLETED") ? (
                    <Link
                      href={booking.locationCoordinates}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 font-semibold text-white transition hover:bg-slate-700"
                    >
                      View map
                    </Link>
                  ) : null}
                </div>
              </header>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <section className="space-y-2 text-sm">
                  <h3 className="font-semibold text-[var(--text-strong)]">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <form action={startTask}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                        disabled={booking.taskStatus !== "ASSIGNED"}
                      >
                        Start task
                      </button>
                    </form>
                    <form action={completeTask}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                        disabled={booking.taskStatus !== "IN_PROGRESS"}
                      >
                        Complete task
                      </button>
                    </form>
                    {booking.taskStatus === "IN_PROGRESS" || booking.taskStatus === "COMPLETED" ? (
                      <Link
                        href={`/driver/bookings/${booking.id}`}
                        className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                      >
                        View details
                      </Link>
                    ) : null}
                    {booking.taskStatus === "COMPLETED" ? (
                      <Link
                        href={`/driver/invoices/${booking.id}`}
                        className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                      >
                        Print invoice
                      </Link>
                    ) : null}
                  </div>
                  {booking.taskStatus === "ASSIGNED" ? (
                    <p className="text-xs text-[var(--text-muted)]">Start the task to unlock location and cash collection details.</p>
                  ) : null}
                </section>
                <section className="space-y-2 text-sm">
                  <h3 className="font-semibold text-[var(--text-strong)]">Cash collection</h3>
                  {booking.taskStatus === "IN_PROGRESS" || booking.taskStatus === "COMPLETED" ? (
                    <form action={submitCashDetails} className="space-y-2">
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          name="cashCollected"
                          defaultChecked={booking.cashCollected}
                          className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                        />
                        <span>Cash received</span>
                      </label>
                      <input
                        type="number"
                        name="cashAmount"
                        step="0.01"
                        min={0}
                        defaultValue={booking.cashAmountCents ? (booking.cashAmountCents / 100).toFixed(2) : ""}
                        placeholder="Amount in AED"
                        className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-xs focus:border-[var(--brand-primary)] focus:outline-none"
                      />
                      <textarea
                        name="driverNotes"
                        defaultValue={booking.driverNotes ?? ""}
                        rows={2}
                        placeholder="Notes about this job"
                        className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-xs focus:border-[var(--brand-primary)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                      >
                        Save cash details
                      </button>
                    </form>
                  ) : (
                    <p className="rounded-lg border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)]">
                      Cash form will unlock once you press &quot;Start task&quot;.
                    </p>
                  )}
                </section>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
