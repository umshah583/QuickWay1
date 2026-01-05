import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
  }).format((cents ?? 0) / 100);
}

export default async function AdminInvoicesPage() {
  const bookings = await prisma.booking.findMany({
    orderBy: { startAt: "desc" },
    take: 100,
    include: {
      user: true,
      driver: true,
      service: true,
      payment: true,
    },
  });

  const totalInvoices = bookings.length;
  const paidCount = bookings.filter((booking) => booking.payment?.status === "PAID" || booking.cashCollected).length;
  const outstandingCount = totalInvoices - paidCount;
  const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0), 0);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]">Billing</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--text-strong)]">Invoices</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Review booking invoices, track paid vs. outstanding balances, and open any invoice to download a printable copy.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-500">Total Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Paid</p>
              <p className="mt-2 text-2xl font-semibold text-white">{paidCount}</p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-600">Outstanding</p>
              <p className="mt-2 text-2xl font-semibold text-amber-600">{outstandingCount}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text-strong)]">Recent invoices</p>
            <p className="text-xs text-[var(--text-muted)]">Showing the 100 most recent bookings</p>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-[var(--text-muted)]">
            No bookings found yet. As soon as customers place bookings, invoices will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm text-[var(--text-medium)]">
              <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)] text-[var(--text-muted)]">
                <tr className="text-xs uppercase tracking-[0.2em]">
                  <th className="px-6 py-3 font-semibold">Booking</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-right">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {bookings.map((booking) => {
                  const paymentStatus = booking.payment?.status === "PAID" || booking.cashCollected ? "Paid" : "Unpaid";
                  const badgeClass =
                    paymentStatus === "Paid"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500";
                  const amountCents = booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0;

                  return (
                    <tr key={booking.id} className="hover:bg-[var(--surface-secondary)]/30">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[var(--text-strong)]">{booking.id}</span>
                          <span className="text-xs text-[var(--text-muted)]">{format(booking.startAt, "MMM d, yyyy • h:mm a")}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--text-strong)]">{booking.user?.name ?? "Customer"}</span>
                          <span className="text-xs text-[var(--text-muted)]">{booking.user?.email ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--text-strong)]">{booking.service?.name ?? "Service"}</span>
                          <span className="text-xs text-[var(--text-muted)]">{booking.driver?.name ? `Driver: ${booking.driver.name}` : "Driver: —"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-[var(--text-strong)]">
                        {formatCurrency(amountCents)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link href={`/admin/invoices/${booking.id}`} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
