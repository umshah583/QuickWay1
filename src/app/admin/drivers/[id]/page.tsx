import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDriverDutySettings } from "@/lib/admin-settings";
import { DutyScheduleManager } from "../DutyScheduleManager";

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
  });

  if (!driver) {
    notFound();
  }

  const dutySettings = await getDriverDutySettings(id);

  // Fetch driver bookings separately
  const driverBookings = await prisma.booking.findMany({
    where: { driverId: id },
    orderBy: { startAt: "desc" },
  });

  const completed = driverBookings.filter((b) => b.taskStatus === "COMPLETED");
  const active = driverBookings.filter((b) => b.taskStatus !== "COMPLETED");
  const lifetimeValue = driverBookings.reduce((sum, booking) => {
    const payment = 0; // We don't have payment relation
    const cash = booking.cashCollected ? booking.cashAmountCents ?? booking.servicePriceCents ?? 0 : 0;
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
            {driverBookings[0]?.startAt ? formatDistanceToNow(driverBookings[0].startAt, { addSuffix: true }) : "Never"}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Most recent booking start time.</p>
        </article>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Duty schedule</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Configure this driver&apos;s weekly duty windows with split shifts, edits, and quick removals.
            </p>
          </div>
          {dutySettings.startTime && dutySettings.endTime ? (
            <div className="rounded-full border border-[var(--surface-border)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
              Today&apos;s duty: {dutySettings.startTime} – {dutySettings.endTime}
            </div>
          ) : (
            <div className="rounded-full border border-[var(--surface-border)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
              No duty window configured for today (defaults will be used).
            </div>
          )}
        </div>
        <DutyScheduleManager driverId={driver.id} weeklySchedule={dutySettings.weeklySchedule} />
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
              {driverBookings.map((booking) => (
                <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="font-medium text-[var(--text-strong)]">Service</p>
                      <p className="text-xs text-[var(--text-muted)]">#{booking.id.slice(-6)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    Guest
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
                    {formatCurrency(booking.cashAmountCents ?? booking.servicePriceCents ?? 0)}
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
