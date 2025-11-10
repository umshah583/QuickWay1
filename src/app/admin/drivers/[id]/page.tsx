import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

type DriverProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function DriverProfilePage({ params }: DriverProfilePageProps) {
  const { id } = await params;

  const driver = await prisma.user.findUnique({
    where: { id, role: "DRIVER" },
    include: {
      driverBookings: {
        include: {
          service: true,
          user: { select: { name: true, email: true } },
          payment: true,
        },
        orderBy: { startAt: "desc" },
      },
    },
  });

  if (!driver) {
    notFound();
  }

  const completed = driver.driverBookings.filter((b) => b.taskStatus === "COMPLETED");
  const active = driver.driverBookings.filter((b) => b.taskStatus !== "COMPLETED");
  const lifetimeValue = driver.driverBookings.reduce((sum, booking) => {
    const payment = booking.payment?.amountCents ?? 0;
    const cash = booking.cashCollected ? booking.cashAmountCents ?? booking.service?.priceCents ?? 0 : 0;
    return sum + payment + cash;
  }, 0);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">{driver.name ?? driver.email ?? "Driver"}</h1>
        <p className="text-sm text-[var(--text-muted)]">{driver.email ?? "No email provided"}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Active jobs</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{active.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Currently assigned and in progress.</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{completed.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Jobs completed to date.</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Lifetime value</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(lifetimeValue)}</p>
          <p className="text-xs text-[var(--text-muted)]">Payments processed under this driver.</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Last assignment</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
            {driver.driverBookings[0]?.startAt ? formatDistanceToNow(driver.driverBookings[0].startAt, { addSuffix: true }) : "Never"}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Most recent booking start time.</p>
        </article>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-strong)]">Booking history</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {driver.driverBookings.map((booking) => (
                <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="font-medium text-[var(--text-strong)]">{booking.service?.name ?? "Service"}</p>
                      <p className="text-xs text-[var(--text-muted)]">#{booking.id.slice(-6)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {booking.user?.name ?? booking.user?.email ?? "Guest"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {format(booking.startAt, "MMM d, yyyy • h:mm a")}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    <span className="inline-flex items-center rounded-full bg-[var(--brand-accent)]/30 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                      {booking.taskStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-strong)]">
                    {formatCurrency(booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link
        href="/admin/drivers"
        className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
      >
        Back to drivers
      </Link>
    </div>
  );
}
