import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminPartnerPageProps = {
  params: Promise<{ id: string }>;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

const partnerInclude = {
  drivers: {
    include: {
      driverBookings: {
        select: {
          id: true,
          startAt: true,
          taskStatus: true,
          status: true,
          cashCollected: true,
          cashAmountCents: true,
          service: { select: { name: true, priceCents: true } },
        },
        orderBy: { startAt: "desc" },
      },
    },
  },
  bookings: {
    select: {
      id: true,
      startAt: true,
      taskStatus: true,
      status: true,
      cashCollected: true,
      cashAmountCents: true,
      createdAt: true,
      service: { select: { name: true, priceCents: true } },
      payment: { select: { status: true, amountCents: true } },
    },
    orderBy: { startAt: "desc" },
  },
} as const;

export default async function AdminPartnerDetailPage({ params }: AdminPartnerPageProps) {
  const { id } = await params;

  const isValidObjectId = /^[a-f\d]{24}$/i;
  if (!isValidObjectId.test(id)) {
    notFound();
  }

  const partner = await prisma.partner.findUnique({
    where: { id },
    include: partnerInclude,
  });

  if (!partner) {
    notFound();
  }

  const activeJobs = partner.bookings.filter((booking) => booking.taskStatus !== "COMPLETED");
  const completedJobs = partner.bookings.filter((booking) => booking.taskStatus === "COMPLETED");
  const totalEarnings = partner.bookings.reduce((sum, booking) => {
    if (booking.payment?.status === "PAID") {
      return sum + (booking.payment.amountCents ?? booking.service?.priceCents ?? 0);
    }
    if (booking.cashCollected) {
      return sum + (booking.cashAmountCents ?? booking.service?.priceCents ?? 0);
    }
    return sum;
  }, 0);

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

  const recentBookings = partner.bookings.slice(0, 10);

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
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activeJobs.length}</p>
          </article>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Completed jobs</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{completedJobs.length}</p>
          </article>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total earnings</h2>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalEarnings)}</p>
          </article>
        </div>
      </header>

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
                const value = booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
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
