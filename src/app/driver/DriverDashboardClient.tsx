'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { startTask, completeTask, submitCashDetails } from './actions';

type DriverBookingItem = {
  id: string;
  startAt: Date;
  endAt: Date;
  taskStatus: string;
  status: string;
  cashCollected: boolean | null;
  cashAmountCents: number | null;
  driverNotes: string | null;
  locationLabel: string | null;
  locationCoordinates: string | null;
  service: {
    id: string;
    name: string;
    priceCents: number;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  payment: {
    id: string;
    status: string;
    amountCents: number;
  } | null;
};

type DriverDashboardData = {
  assignmentBookings: DriverBookingItem[];
  cashBookings: DriverBookingItem[];
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  totalValueCents: number;
  collectedCents: number;
  pendingCents: number;
  collectedCount: number;
  totalCashCollected: number;
  showAssignmentsEmpty: boolean;
  showCashEmpty: boolean;
};

type DriverSectionFlags = {
  driverTabOverview: boolean;
  driverTabAssignments: boolean;
  driverTabCash: boolean;
};

type DriverDutySettings = {
  startTime: string | null;
  endTime: string | null;
};

type DriverDashboardClientProps = {
  data: DriverDashboardData;
  featureFlags: DriverSectionFlags;
  dutySettings?: DriverDutySettings;
};

type Section = 'overview' | 'assignments' | 'cash';

type SectionMeta = {
  id: Section;
  label: string;
  description: string;
};

const sections: SectionMeta[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'View job statistics and performance.',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    description: 'Manage current tasks and cash collection.',
  },
  {
    id: 'cash',
    label: 'Cash Collection',
    description: 'View and manage cash payments.',
  },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function buildMapLink(locationCoordinates: string | null | undefined): string | null {
  if (!locationCoordinates) {
    return null;
  }

  if (/^https?:\/\//i.test(locationCoordinates)) {
    return locationCoordinates;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationCoordinates)}`;
}

export default function DriverDashboardClient({ data, featureFlags, dutySettings }: DriverDashboardClientProps) {
  const sectionOrder: Section[] = ['overview', 'assignments', 'cash'];
  const enabledSections = sectionOrder.filter((section) => {
    if (section === 'overview') return featureFlags.driverTabOverview;
    if (section === 'assignments') return featureFlags.driverTabAssignments;
    if (section === 'cash') return featureFlags.driverTabCash;
    return true;
  });

  const [activeSection, setActiveSection] = useState<Section | null>(enabledSections[0] ?? null);

  const {
    assignmentBookings,
    cashBookings,
    totalJobs,
    activeJobs,
    completedJobs,
    totalValueCents,
    collectedCents,
    pendingCents,
    collectedCount,
    totalCashCollected,
    showAssignmentsEmpty,
    showCashEmpty,
  } = data;

  const [localCashCollected, setLocalCashCollected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (enabledSections.length === 0) {
      setActiveSection(null);
      return;
    }

    const hasActive = enabledSections.includes(activeSection as Section);
    if (!hasActive) {
      setActiveSection(enabledSections[0]);
    }
  }, [enabledSections, activeSection]);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {enabledSections.length ? (
          <aside className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 lg:w-64">
            <nav className="space-y-2 text-sm">
              {sections
                .filter((section) => enabledSections.includes(section.id))
                .map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full rounded-xl px-4 py-3 text-left font-semibold transition ${
                        isActive
                          ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-border)]/40 hover:text-[var(--text-strong)]'
                      }`}
                    >
                      <span className="block text-sm">{section.label}</span>
                      <span className="block text-xs font-normal text-[var(--text-muted)]">{section.description}</span>
                    </button>
                  );
                })}
            </nav>
          </aside>
        ) : null}

        <main className="flex-1 space-y-6">
          {dutySettings?.startTime && dutySettings?.endTime ? (
            <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 text-sm">
              <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Daily duty time</h2>
              <p className="mt-2 text-base font-semibold text-[var(--text-strong)]">
                {dutySettings.startTime} - {dutySettings.endTime}
              </p>
            </section>
          ) : null}
          {!activeSection ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--text-muted)]">
              All driver dashboard modules are disabled by admin.
            </div>
          ) : null}

          {activeSection === 'overview' && featureFlags.driverTabOverview ? (
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
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Completed jobs</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{completedJobs}</p>
                <p className="text-xs text-[var(--text-muted)]">Tasks finished</p>
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
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 sm:col-span-2">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total cash collected</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalCashCollected)}</p>
                <p className="text-xs text-[var(--text-muted)]">All time collections</p>
              </article>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 sm:col-span-2">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Pending value</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalValueCents)}</p>
              </article>
            </section>
          ) : null}

          {activeSection === 'assignments' && featureFlags.driverTabAssignments ? (
            <section className="space-y-4">
              <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Today&apos;s tasks</h1>
                <p className="text-sm text-[var(--text-muted)]">Review each booking and update the status as you progress.</p>
              </header>

              <div className="grid gap-4">
                {showAssignmentsEmpty ? (
                  <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-6 text-center text-sm text-[var(--text-muted)]">
                    No bookings assigned for today yet.
                  </div>
                ) : (
                  assignmentBookings.map((booking) => {
                    const paymentStatus = booking.payment?.status ?? "REQUIRES_PAYMENT";
                    const locationHref = buildMapLink(booking.locationCoordinates);
                    const showMapLink = Boolean(locationHref && ["IN_PROGRESS", "COMPLETED"].includes(booking.taskStatus));
                    const cashFormUnlocked = ["IN_PROGRESS", "COMPLETED"].includes(booking.taskStatus);
                    const isAlreadyPaid = booking.payment?.status === "PAID" || booking.status === "PAID";
                    const showCashForm = cashFormUnlocked && !isAlreadyPaid;

                    const isCash = !booking.payment || booking.payment.status === "REQUIRES_PAYMENT";
                    const cashDone = localCashCollected[booking.id] ?? Boolean(booking.cashCollected);
                    const isDisabled = booking.taskStatus !== "IN_PROGRESS" || (isCash && !cashDone);

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
                            {showMapLink ? (
                              <a
                                href={locationHref ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 font-semibold text-white transition hover:bg-slate-700"
                              >
                                View map
                              </a>
                            ) : null}
                          </div>
                        </header>

                        <div className={`mt-4 grid gap-4 ${featureFlags.driverTabCash ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
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
                                  disabled={isDisabled}
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
                          {featureFlags.driverTabCash ? (
                            <section className="space-y-2 text-sm">
                              <h3 className="font-semibold text-[var(--text-strong)]">Cash collection</h3>
                              {showCashForm ? (
                                <form action={submitCashDetails} className="space-y-2">
                                  <input type="hidden" name="bookingId" value={booking.id} />
                                  <label className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      name="cashCollected"
                                      defaultChecked={Boolean(booking.cashCollected)}
                                      onChange={(e) => setLocalCashCollected(prev => ({ ...prev, [booking.id]: e.target.checked }))}
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
                              ) : cashFormUnlocked ? (
                                <p className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)]">
                                  Payment already recorded online. No cash collection needed.
                                </p>
                              ) : (
                                <p className="rounded-lg border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)]">
                                  Cash form will unlock once you press Start task.
                                </p>
                              )}
                            </section>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}

          {activeSection === 'cash' && featureFlags.driverTabCash ? (
            <section className="space-y-4">
              <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Cash Collection</h1>
                <p className="text-sm text-[var(--text-muted)]">View and manage cash payments for your jobs.</p>
              </header>

              <div className="grid gap-4">
                {showCashEmpty ? (
                  <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-6 text-center text-sm text-[var(--text-muted)]">
                    No bookings to display.
                  </div>
                ) : (
                  cashBookings.map((booking) => {
                    const cashStatus = booking.cashCollected ? 'Collected' : 'Pending';
                    const cashAmount = booking.cashAmountCents ? formatCurrency(booking.cashAmountCents) : formatCurrency(booking.service?.priceCents ?? 0);

                    return (
                      <article key={booking.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{booking.service?.name ?? "Service"}</h3>
                            <p className="text-sm text-[var(--text-muted)]">Customer: {booking.user?.email ?? "Guest"}</p>
                            <p className="text-sm text-[var(--text-muted)]">Amount: {cashAmount}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${booking.cashCollected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {cashStatus}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

// Note: startTask, completeTask, submitCashDetails are imported from actions, but since it's client, need to handle differently.
// Actually, since forms post to server actions, it's fine.
