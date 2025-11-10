import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireDriverSession } from "@/lib/driver-auth";

export const dynamic = "force-dynamic";

interface DriverBookingPageProps {
  params: Promise<{ id: string }>;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

type DriverBookingWithMeta =
  Prisma.BookingGetPayload<{
    include: {
      user: true;
      service: true;
      payment: true;
    };
  }> & {
    locationLabel: string | null;
    locationCoordinates: string | null;
  };

export default async function DriverBookingDetailPage({ params }: DriverBookingPageProps) {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const { id } = await params;

  const booking = (await prisma.booking.findFirst({
    where: { id, driverId },
    include: {
      user: true,
      service: true,
      payment: true,
    },
  })) as DriverBookingWithMeta | null;

  if (!booking) {
    notFound();
  }

  const servicePrice = booking.service?.priceCents ?? 0;
  const cashCollected = booking.cashCollected ? booking.cashAmountCents ?? servicePrice : 0;
  const cashPending = Math.max(servicePrice - cashCollected, 0);
  const paymentStatus = booking.payment?.status ?? "REQUIRES_PAYMENT";
  const mapsLink = booking.locationCoordinates;
  const locationLabel = booking.locationLabel || "Customer location";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Booking details</p>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">{booking.service?.name ?? "Service"}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Scheduled for {format(booking.startAt, "EEEE, MMMM d 'at' h:mm a")} • Duration {booking.service?.durationMin ?? "–"} minutes
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 text-sm sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Job status</h2>
          <p>
            <span className="font-semibold text-[var(--text-strong)]">Task:</span> {booking.taskStatus}
          </p>
          <p>
            <span className="font-semibold text-[var(--text-strong)]">Booking:</span> {booking.status}
          </p>
          <p>
            <span className="font-semibold text-[var(--text-strong)]">Payment:</span> {paymentStatus}
          </p>
          {mapsLink ? (
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--text-strong)]">Location:</span>
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
              >
                {locationLabel}
              </a>
            </p>
          ) : null}
        </div>
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Customer</h2>
          <p className="font-medium text-[var(--text-strong)]">{booking.user?.name ?? booking.user?.email ?? "Customer"}</p>
          <p className="text-[var(--text-muted)]">{booking.user?.email ?? "No email on file"}</p>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 text-sm sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Cash collection</h2>
          <p>
            Collected: <span className="font-semibold text-[var(--text-strong)]">{formatCurrency(cashCollected)}</span>
          </p>
          <p>
            Pending: <span className="font-semibold text-[var(--text-strong)]">{formatCurrency(cashPending)}</span>
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Notes</h2>
          <p className="text-[var(--text-muted)]">{booking.driverNotes ?? "No driver notes recorded."}</p>
        </div>
      </section>

      <footer className="flex flex-wrap gap-3">
        <Link
          href="/driver"
          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Back to dashboard
        </Link>
        {booking.taskStatus === "COMPLETED" ? (
          <Link
            href={`/driver/invoices/${booking.id}`}
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            Print invoice
          </Link>
        ) : null}
      </footer>
    </div>
  );
}
