"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import Link from "next/link";

type BookingData = {
  id: string;
  startAt: string;
  taskCompletedAt: string | null;
  cashAmountCents: number | null;
  cashCollected: boolean;
  cashSettled: boolean;
  service: { name: string; priceCents: number } | null;
  driver: { id: string; name: string | null; email: string | null } | null;
  user: { id: string; name: string | null; email: string | null } | null;
  payment: { id: string } | null;
};

type DriverSummary = {
  id: string;
  name: string;
  email: string;
  jobs: number;
  collected: number;
  settled: number;
  unsettled: number;
  lastJobDate?: string;
};

type CollectionsData = {
  bookings: BookingData[];
  totals: {
    collected: number;
    settled: number;
    unsettled: number;
    count: number;
  };
  driverSummaries: DriverSummary[];
};

type FilterType = "all" | "settled" | "unsettled";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function deriveIdentifiers(booking: BookingData) {
  const reference = booking.payment?.id?.trim() || booking.id;
  const shortId = reference.slice(-6).toUpperCase();
  const datePart = format(new Date(booking.startAt), "yyyyMMdd");
  const orderId = `ORD-${datePart}-${shortId}`;
  const invoiceNumber = `INV-${datePart}-${shortId}`;
  return { orderId, invoiceNumber };
}

function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD format
}

export default function CollectionsClient() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString()); // Default to today
  const [data, setData] = useState<CollectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set("date", selectedDate);
      if (filter !== "all") params.set("filter", filter);

      const res = await fetch(`/api/admin/collections?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch collections");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [filter, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: { key: FilterType; label: string; color: string }[] = [
    { key: "all", label: "All Collections", color: "text-[var(--text-strong)]" },
    { key: "settled", label: "Settled", color: "text-emerald-600" },
    { key: "unsettled", label: "Unsettled", color: "text-amber-600" },
  ];

  if (error) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Collections</h1>
          <p className="text-sm text-red-500">{error}</p>
        </header>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Collections</h1>
          <p className="text-sm text-[var(--text-muted)]">Monitor cash collected by drivers and pending hand-ins.</p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center">
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5">
            Jobs: <strong className="text-[var(--text-strong)]">{data?.totals.count ?? 0}</strong>
          </span>
          <a
            href="/admin/collections/export"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
          >
            Download Excel
          </a>
        </div>
      </header>

      {/* Filters Section */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                filter === tab.key
                  ? "bg-[var(--brand-primary)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--text-muted)]">Filter by date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
          {selectedDate && (
            <button
              onClick={() => setSelectedDate("")}
              className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--brand-primary)] border-t-transparent"></div>
        </div>
      ) : !data || data.bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-8 text-center text-sm text-[var(--text-muted)]">
          {selectedDate
            ? `No collections found for ${format(new Date(selectedDate), "MMMM d, yyyy")}.`
            : filter === "settled"
            ? "No settled cash collections."
            : filter === "unsettled"
            ? "No unsettled cash collections."
            : "No cash collections yet."}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
              <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total Collected</h2>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(data.totals.collected)}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {selectedDate ? `On ${format(new Date(selectedDate), "MMM d, yyyy")}` : "All time"}
              </p>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">Settled Cash</h2>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatCurrency(data.totals.settled)}</p>
              <p className="text-xs text-emerald-600/70">Cash handed in to admin</p>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-amber-700 dark:text-amber-400">Unsettled Cash</h2>
              <p className="mt-2 text-2xl font-semibold text-amber-600">{formatCurrency(data.totals.unsettled)}</p>
              <p className="text-xs text-amber-600/70">Pending hand-in from drivers</p>
            </article>
            <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
              <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Average per job</h2>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">
                {formatCurrency(data.totals.count ? Math.round(data.totals.collected / data.totals.count) : 0)}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Mean collection value</p>
            </article>
          </section>

          {/* Driver Summaries */}
          <section className="space-y-3">
            <header>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Driver Collections</h2>
              <p className="text-xs text-[var(--text-muted)]">Summaries grouped by driver assignment.</p>
            </header>
            <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Driver</th>
                    <th className="px-4 py-3 font-medium">Jobs</th>
                    <th className="px-4 py-3 font-medium">Collected</th>
                    <th className="px-4 py-3 font-medium">Settled</th>
                    <th className="px-4 py-3 font-medium">Unsettled</th>
                    <th className="px-4 py-3 font-medium">Last Job</th>
                  </tr>
                </thead>
                <tbody>
                  {data.driverSummaries.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-[var(--text-muted)]" colSpan={6}>
                        No driver assignments.
                      </td>
                    </tr>
                  ) : (
                    data.driverSummaries.map((summary) => (
                      <tr key={summary.id} className="border-t border-[var(--surface-border)]">
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className="font-medium text-[var(--text-strong)]">{summary.name}</p>
                            {summary.email && <p className="text-xs text-[var(--text-muted)]">{summary.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">{summary.jobs}</td>
                        <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{formatCurrency(summary.collected)}</td>
                        <td className="px-4 py-3 font-medium text-emerald-600">{formatCurrency(summary.settled)}</td>
                        <td className="px-4 py-3 font-medium text-amber-600">{formatCurrency(summary.unsettled)}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">
                          {summary.lastJobDate ? format(new Date(summary.lastJobDate), "MMM d, yyyy • h:mm a") : ""}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Collection Details */}
          <section className="space-y-3">
            <header>
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Collection Details</h2>
              <p className="text-xs text-[var(--text-muted)]">Individual cash bookings with customer and driver data.</p>
            </header>
            <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Booking Date</th>
                    <th className="px-4 py-3 font-medium">Collection Date</th>
                    <th className="px-4 py-3 font-medium">Order ID</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Driver</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((booking) => {
                    const amount = booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
                    const { orderId } = deriveIdentifiers(booking);

                    return (
                      <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--text-strong)]">
                            {format(new Date(booking.startAt), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {format(new Date(booking.startAt), "h:mm a")}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {booking.taskCompletedAt ? (
                            <>
                              <p className="font-medium text-[var(--text-strong)]">
                                {format(new Date(booking.taskCompletedAt), "MMM d, yyyy")}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {format(new Date(booking.taskCompletedAt), "h:mm a")}
                              </p>
                            </>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{orderId}</td>
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
                          <p className="font-medium text-[var(--text-strong)]">
                            {booking.driver?.name || booking.driver?.email || "Unassigned"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {booking.cashSettled ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Settled
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Unsettled
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--text-strong)]">
                          {formatCurrency(amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/admin/invoices/${booking.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-accent)]/30"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
