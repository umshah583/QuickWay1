import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

type AdminCustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCustomerDetailPage({ params }: AdminCustomerDetailPageProps) {
  const { id } = await params;

  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { startAt: "desc" },
        include: {
          service: true,
          payment: true,
          driver: true,
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  type CustomerBooking = typeof customer.bookings[number];

  const totalBookings = customer.bookings.length;
  const paidBookings = customer.bookings.filter((booking: CustomerBooking) => booking.status === "PAID").length;
  const cancelledBookings = customer.bookings.filter((booking: CustomerBooking) => booking.status === "CANCELLED").length;
  const totalValueCents = customer.bookings.reduce(
    (sum: number, booking: CustomerBooking) => sum + (booking.service?.priceCents ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-primary)] hover:underline"
      >
        ← Back to customers
      </Link>

      <header className="space-y-2">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-strong)]">{customer.name || customer.email || "Customer"}</h1>
            <p className="text-sm text-[var(--text-muted)]">Customer profile and booking history.</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Email</dt>
              <dd className="font-medium text-[var(--text-strong)]">{customer.email ?? "—"}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Bookings</dt>
              <dd className="font-medium text-[var(--text-strong)]">{totalBookings}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Total bookings</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{totalBookings}</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Paid bookings</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{paidBookings}</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Cancelled</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{cancelledBookings}</p>
        </article>
        <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Total value</h2>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalValueCents)}</p>
        </article>
      </section>

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Booking history</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Most recent first</span>
        </header>

        {customer.bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--text-muted)]">
            This customer has not made any bookings yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {customer.bookings.map((booking: CustomerBooking) => {
                  const paymentStatus = booking.payment?.status ?? "REQUIRES_PAYMENT";
                  const value = booking.service?.priceCents ?? 0;

                  return (
                    <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{booking.service?.name ?? "Booking"}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{format(booking.startAt, "MMM d, yyyy • h:mm a")}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {booking.driver?.name || booking.driver?.email || "Unassigned"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            booking.status === "PAID"
                              ? "bg-emerald-100 text-emerald-700"
                              : booking.status === "CANCELLED"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            paymentStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-700"
                              : paymentStatus === "REFUNDED"
                              ? "bg-blue-100 text-blue-700"
                              : paymentStatus === "CANCELED"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--text-strong)]">
                        {formatCurrency(value)}
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
