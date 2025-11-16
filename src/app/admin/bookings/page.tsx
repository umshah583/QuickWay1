import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { updateBookingStatus } from "./actions";
import AdminBookingsAutoRefresh from "./AdminBookingsAutoRefresh";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

export const dynamic = "force-dynamic";

type BookingListItem =
  Prisma.BookingGetPayload<{
    include: {
      user: true;
      service: true;
      payment: true;
      driver: true;
    };
  }> & {
    locationLabel: string | null;
    locationCoordinates: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleColor: string | null;
    vehiclePlate: string | null;
  };

const BOOKING_STATUSES = ["ASSIGNED", "PENDING", "PAID", "CANCELLED"] as const;
const PAYMENT_STATUSES = ["REQUIRES_PAYMENT", "PAID", "REFUNDED", "CANCELED"] as const;
const PAGE_SIZE = 10;

type SearchParams = Record<string, string | string[] | undefined>;

type AdminBookingsProps = {
  searchParams: Promise<SearchParams>;
};

function parseParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeStatus(value: string | string[] | undefined, allowed: readonly string[]) {
  const raw = parseParam(value).toUpperCase();
  return allowed.includes(raw) ? raw : "";
}

export default async function AdminBookingsPage({ searchParams }: AdminBookingsProps) {
  const params = await searchParams;

  const bookingStatusFilter = normalizeStatus(params.status, BOOKING_STATUSES);
  const paymentStatusFilter = normalizeStatus(params.paymentStatus, PAYMENT_STATUSES);
  const dateFilter = parseParam(params.date);
  const queryRaw = parseParam(params.q);
  const query = queryRaw.trim().toLowerCase();
  const pageParam = parseParam(params.page);

  const allBookings = (await prisma.booking.findMany({
    orderBy: { startAt: "desc" },
    include: {
      user: true,
      service: true,
      payment: true,
      driver: true,
    },
  })) as BookingListItem[];

  const filteredBookings = allBookings.filter((booking: BookingListItem) => {
    const matchesStatus = bookingStatusFilter ? booking.status === bookingStatusFilter : true;
    const paymentState = booking.payment?.status ?? "REQUIRES_PAYMENT";
    const matchesPayment = paymentStatusFilter ? paymentState === paymentStatusFilter : true;
    const matchesDate = dateFilter ? format(booking.startAt, "yyyy-MM-dd") === dateFilter : true;
    const matchesQuery = query
      ? booking.service?.name.toLowerCase().includes(query) ||
        booking.user?.email?.toLowerCase().includes(query) ||
        format(booking.startAt, "MMM d, yyyy").toLowerCase().includes(query)
      : true;

    return matchesStatus && matchesPayment && matchesDate && matchesQuery;
  });

  const totalCount = filteredBookings.length;
  const assignedCount = filteredBookings.filter((b: BookingListItem) => b.status === "ASSIGNED").length;
  const pendingCount = filteredBookings.filter((b: BookingListItem) => b.status === "PENDING").length;
  const paidCount = filteredBookings.filter((b: BookingListItem) => b.status === "PAID").length;
  const cancelledCount = filteredBookings.filter((b: BookingListItem) => b.status === "CANCELLED").length;
  const cashPending = filteredBookings.filter((b: BookingListItem) => b.cashCollected && !b.cashSettled).length;
  const totalValue = filteredBookings.reduce((sum: number, booking: BookingListItem) => {
    const amount = booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
    return sum + amount;
  }, 0);

  const parsedPage = Number.parseInt(pageParam, 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageBookings = filteredBookings.slice(startIndex, startIndex + PAGE_SIZE);
  const firstItem = totalCount === 0 ? 0 : startIndex + 1;
  const lastItem = Math.min(startIndex + PAGE_SIZE, totalCount);

  const createPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (queryRaw) params.set("q", queryRaw);
    if (bookingStatusFilter) params.set("status", bookingStatusFilter);
    if (paymentStatusFilter) params.set("paymentStatus", paymentStatusFilter);
    if (dateFilter) params.set("date", dateFilter);
    if (targetPage > 1) params.set("page", String(targetPage));
    const queryString = params.toString();
    return `/admin/bookings${queryString ? `?${queryString}` : ""}`;
  };

  if (allBookings.length === 0) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Bookings</h1>
          <p className="text-sm text-[var(--text-muted)]">
            No bookings yet. Once customers schedule, they will appear here.
          </p>
        </header>
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Use the public site to create bookings or build a create flow here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminBookingsAutoRefresh />
      <header className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Order management</h1>
            <p className="text-sm text-[var(--text-muted)]">Search, filter, and manage every booking from a single view.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)] sm:flex sm:flex-wrap sm:justify-end">
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Total <strong className="ml-1 text-[var(--text-strong)]">{totalCount}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Assigned <strong className="ml-1 text-[var(--text-strong)]">{assignedCount}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Pending <strong className="ml-1 text-[var(--text-strong)]">{pendingCount}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Paid <strong className="ml-1 text-[var(--text-strong)]">{paidCount}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Cancelled <strong className="ml-1 text-[var(--text-strong)]">{cancelledCount}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Cash pending <strong className="ml-1 text-[var(--text-strong)]">{cashPending}</strong>
            </span>
            <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
              Value <strong className="ml-1 text-[var(--text-strong)]">{formatCurrency(totalValue)}</strong>
            </span>
          </div>
        </div>

        <form
          method="get"
          className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 px-5 py-6 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="flex min-w-[240px] flex-1 flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Search orders</span>
            <input
              type="search"
              name="q"
              defaultValue={queryRaw}
              placeholder="Search by customer, service, driver, or booking ID"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Booking status</span>
            <select
              name="status"
              defaultValue={bookingStatusFilter ?? ""}
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            >
              <option value="">All</option>
              {BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Payment</span>
            <select
              name="paymentStatus"
              defaultValue={paymentStatusFilter ?? ""}
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            >
              <option value="">All</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Scheduled date</span>
            <input
              type="date"
              name="date"
              defaultValue={dateFilter}
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
            >
              Apply filters
            </button>
            <Link
              href="/admin/bookings"
              className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              Reset
            </Link>
          </div>
        </form>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm">
        <table className="min-w-full divide-y divide-[var(--surface-border)] text-sm">
          <thead className="bg-[var(--background)]/60">
            <tr className="text-left text-[var(--text-muted)]">
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Driver</th>
              <th className="px-4 py-3 font-semibold">Scheduled</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Payment</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {pageBookings.length > 0 ? (
              pageBookings.map((booking: BookingListItem) => {
                const paymentStatus = booking.payment?.status ?? "REQUIRES_PAYMENT";
                const isCompleted = booking.status === "PAID" && booking.taskStatus === "COMPLETED";
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
                        <span className="font-medium text-[var(--text-strong)]">{booking.user?.name ?? booking.user?.email ?? "Guest"}</span>
                        <span className="text-xs text-[var(--text-muted)]">{booking.user?.email ?? "No email"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <div className="flex flex-col">
                        <span>{booking.driver?.name ?? booking.driver?.email ?? "Unassigned"}</span>
                        <span className="text-xs text-[var(--text-muted)]">{booking.driver ? "Assigned" : "Awaiting"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <div className="flex flex-col">
                        <span>{format(booking.startAt, "MMM d, yyyy")}</span>
                        <span className="text-xs text-[var(--text-muted)]">{format(booking.startAt, "h:mm a")} · {format(booking.endAt, "h:mm a")}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-strong)]">
                      {formatCurrency(booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          paymentStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-700"
                            : booking.status === "CANCELLED"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                        <form action={updateBookingStatus} className="flex items-center gap-2 text-xs">
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <select
                            name="status"
                            defaultValue={booking.status}
                            disabled={isCompleted}
                            className="rounded-full border border-[var(--surface-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {BOOKING_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            disabled={isCompleted}
                            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-3 py-1.5 font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:bg-[var(--surface-border)] disabled:text-[var(--text-muted)]"
                          >
                            Update
                          </button>
                        </form>
                        {isCompleted ? (
                          <span
                            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] opacity-60"
                            aria-disabled="true"
                          >
                            View
                          </span>
                        ) : (
                          <Link
                            href={`/admin/bookings/${booking.id}`}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                  No bookings match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            Showing <span className="font-semibold text-[var(--text-strong)]">{firstItem}</span>-
            <span className="font-semibold text-[var(--text-strong)]">{lastItem}</span> of
            <span className="font-semibold text-[var(--text-strong)]"> {totalCount}</span> bookings
          </p>
          <div className="flex items-center gap-2">
            {safePage > 1 ? (
              <Link
                href={createPageHref(safePage - 1)}
                className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                Previous
              </Link>
            ) : (
              <span
                className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] opacity-60"
                aria-disabled="true"
              >
                Previous
              </span>
            )}
            <span className="text-xs text-[var(--text-muted)]">
              Page <span className="font-semibold text-[var(--text-strong)]">{safePage}</span> of
              <span className="font-semibold text-[var(--text-strong)]"> {totalPages}</span>
            </span>
            {safePage < totalPages ? (
              <Link
                href={createPageHref(safePage + 1)}
                className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                Next
              </Link>
            ) : (
              <span
                className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] opacity-60"
                aria-disabled="true"
              >
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
