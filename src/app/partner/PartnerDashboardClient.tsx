'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';

export type PartnerDashboardData = {
  partner: {
    id: string;
    name: string;
    email: string | null;
    createdAt: string;
  };
  stats: {
    totalDrivers: number;
    onDutyDrivers: number;
    totalAssigned: number;
    activeJobs: number;
    completedJobs: number;
    totalEarnings: number;
    cashPending: number;
    cashSettled: number;
    invoicesPaid: number;
    invoicesPending: number;
  };
  jobStatus: { status: string; count: number }[];
  driverRows: {
    id: string;
    name: string;
    email: string;
    activeCount: number;
    completedCount: number;
    collected: number;
    latest: string | null;
  }[];
  recentBookings: {
    id: string;
    serviceName: string;
    taskStatus: string;
    netAmount: number;
    grossAmount: number;
    isPaid: boolean;
    startAt: string | null;
    cashCollected: boolean;
    cashSettled: boolean;
    paymentStatus: string | null;
  }[];
  requests: {
    id: string;
    name: string;
    email: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    rejectionReason: string | null;
    createdAt: string;
    processedAt: string | null;
    rejectionCount: number;
  }[];
};

type PartnerSectionFlags = {
  partnerTabAssignments: boolean;
  partnerTabDrivers: boolean;
  partnerTabEarnings: boolean;
};

type PartnerDashboardClientProps = {
  data: PartnerDashboardData;
  featureFlags: PartnerSectionFlags;
};

type Section = 'assignments' | 'drivers' | 'earnings';

type SectionMeta = {
  id: Section;
  label: string;
  description: string;
  badge?: string;
};

const sections: SectionMeta[] = [
  {
    id: 'assignments',
    label: 'Assignments',
    description: 'Track current jobs, task statuses, and upcoming work.',
  },
  {
    id: 'drivers',
    label: 'Drivers',
    description: 'Review partner drivers, performance, and add new team members.',
  },
  {
    id: 'earnings',
    label: 'Earnings',
    description: 'Audit revenue, settlement progress, and outstanding balances.',
  },
];

function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format((amountCents ?? 0) / 100);
}

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(' ');
}

export default function PartnerDashboardClient({ data, featureFlags }: PartnerDashboardClientProps) {
  const sectionOrder: Section[] = ['assignments', 'drivers', 'earnings'];
  const enabledSections = sectionOrder.filter((section) => {
    if (section === 'assignments') return featureFlags.partnerTabAssignments;
    if (section === 'drivers') return featureFlags.partnerTabDrivers;
    if (section === 'earnings') return featureFlags.partnerTabEarnings;
    return true;
  });

  const [activeSection, setActiveSection] = useState<Section | null>(enabledSections[0] ?? null);
  const { stats } = data;

  const pendingRequestsCount = useMemo(
    () => data.requests.filter((request) => request.status === 'PENDING').length,
    [data.requests],
  );

  const statusCards = useMemo(
    () =>
      data.jobStatus.map((item) => ({
        label: formatStatusLabel(item.status),
        count: item.count,
      })),
    [data.jobStatus],
  );

  const assignmentsTable = useMemo(() => data.recentBookings.slice(0, 12), [data.recentBookings]);
  const earningsTable = useMemo(
    () =>
      data.recentBookings.slice(0, 12).map((booking) => ({
        ...booking,
        paymentLabel: booking.isPaid ? 'Paid' : booking.paymentStatus?.replace(/_/g, ' ') ?? 'Pending',
        cashLabel: booking.cashSettled
          ? 'Settled'
          : booking.cashCollected
            ? 'Pending settlement'
            : '—',
      })),
    [data.recentBookings],
  );
  const sidebarSections = useMemo(() => {
    const filtered = sections
      .filter((section) => enabledSections.includes(section.id))
      .map((section) => {
        if (section.id === 'drivers' && pendingRequestsCount > 0) {
          return { ...section, badge: String(pendingRequestsCount) } as SectionMeta;
        }
        return section;
      });
    return filtered;
  }, [enabledSections, pendingRequestsCount]);

  useEffect(() => {
    if (sidebarSections.length === 0) {
      setActiveSection(null);
      return;
    }

    const hasActive = sidebarSections.some((section) => section.id === activeSection);
    if (!hasActive) {
      setActiveSection(sidebarSections[0]?.id ?? null);
    }
  }, [sidebarSections, activeSection]);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-gradient-to-br from-[var(--brand-primary)]/15 via-[var(--brand-primary)]/10 to-transparent p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand-primary)]">Partner overview</p>
            <h1 className="text-3xl font-semibold text-[var(--text-strong)]">{data.partner.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/70 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active partner since {format(new Date(data.partner.createdAt), 'd MMM yyyy')}
              </span>
              {data.partner.email ? (
                <span className="rounded-full border border-[var(--surface-border)] bg-white/70 px-3 py-1">{data.partner.email}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/partners"
              className="btn btn-muted"
            >
              View in admin portal
            </Link>
            <Link
              href="mailto:support@quickway.app?subject=Partner%20support%20request"
              className="btn btn-primary"
            >
              Contact support
            </Link>
          </div>
        </div>
      </header>

      {sidebarSections.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {featureFlags.partnerTabDrivers ? (
            <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Drivers</h2>
              <p className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">{stats.totalDrivers}</p>
              <p className="text-xs text-[var(--text-muted)]">{stats.onDutyDrivers} currently on duty</p>
            </article>
          ) : null}
          {featureFlags.partnerTabAssignments ? (
            <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Active jobs</h2>
              <p className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">{stats.activeJobs}</p>
              <p className="text-xs text-[var(--text-muted)]">{stats.totalAssigned} total assigned</p>
            </article>
          ) : null}
          {featureFlags.partnerTabEarnings ? (
            <>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Completed jobs</h2>
                <p className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">{stats.completedJobs}</p>
                <p className="text-xs text-[var(--text-muted)]">{stats.activeJobs} still in progress</p>
              </article>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total earnings</h2>
                <p className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">{formatCurrency(stats.totalEarnings)}</p>
                <p className="text-xs text-[var(--text-muted)]">Cash and invoice collections</p>
              </article>
            </>
          ) : null}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--text-muted)]">
          All partner dashboard modules are disabled by admin.
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {sidebarSections.length ? (
          <aside className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 lg:w-64">
            <nav className="space-y-2 text-sm">
              {sidebarSections.map((section) => {
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
                    <span className="flex items-center gap-2 text-sm">
                      {section.label}
                      {section.badge ? (
                        <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-[10px] font-semibold text-white">
                          {section.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs font-normal text-[var(--text-muted)]">{section.description}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        ) : null}

        <main className="flex-1 space-y-6">
          {!activeSection ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--text-muted)]">
              All partner tabs are currently disabled by your admin.
            </div>
          ) : null}
          {pendingRequestsCount > 0 && activeSection === 'drivers' ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              {pendingRequestsCount} driver request{pendingRequestsCount > 1 ? 's' : ''} awaiting admin approval.
            </div>
          ) : null}

          {activeSection === 'assignments' && featureFlags.partnerTabAssignments ? (
            <section className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-[var(--text-strong)]">Job status summary</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {statusCards.length > 0 ? (
                      statusCards.map((item) => (
                        <li key={item.label} className="flex items-center justify-between rounded-lg border border-[var(--surface-border)] px-3 py-2">
                          <span className="text-[var(--foreground)]/85">{item.label}</span>
                          <span className="font-semibold text-[var(--text-strong)]">{item.count}</span>
                        </li>
                      ))
                    ) : (
                      <li className="rounded-lg border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--text-muted)]">No jobs recorded yet.</li>
                    )}
                  </ul>
                </article>
                <article className="lg:col-span-2">
                  <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                        <tr className="text-xs uppercase tracking-[0.16em]">
                          <th className="px-4 py-3">Booking</th>
                          <th className="px-4 py-3">Service</th>
                          <th className="px-4 py-3">Task status</th>
                          <th className="px-4 py-3">Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignmentsTable.map((booking) => {
                          const scheduled = booking.startAt ? format(new Date(booking.startAt), 'd MMM, h:mma') : '—';
                          const taskBadgeClass =
                            booking.taskStatus === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-700'
                              : booking.taskStatus === 'IN_PROGRESS'
                                ? 'bg-amber-500/15 text-amber-700'
                                : 'bg-[var(--brand-accent)]/15 text-[var(--brand-primary)]';
                          return (
                            <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                              <td className="px-4 py-3 text-[var(--text-muted)]">#{booking.id.slice(-6)}</td>
                              <td className="px-4 py-3 text-[var(--text-strong)]">{booking.serviceName}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${taskBadgeClass}`}>
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                  {formatStatusLabel(booking.taskStatus)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[var(--text-muted)]">{scheduled}</td>
                            </tr>
                          );
                        })}
                        {assignmentsTable.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-muted)]">
                              No bookings assigned yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {activeSection === 'drivers' && featureFlags.partnerTabDrivers ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-strong)]">Driver roster</h2>
                  <p className="text-xs text-[var(--text-muted)]">Monitor driver workload and collections.</p>
                </div>
                <Link
                  href="/partner/drivers"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
                >
                  New driver request
                </Link>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                    <tr className="text-xs uppercase tracking-[0.16em]">
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3">Active jobs</th>
                      <th className="px-4 py-3">Completed</th>
                      <th className="px-4 py-3">Cash collected</th>
                      <th className="px-4 py-3">Last assignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.driverRows.map((driver) => {
                      const lastAssignment = driver.latest
                        ? formatDistanceToNow(new Date(driver.latest), { addSuffix: true })
                        : 'No assignments';
                      return (
                        <tr key={driver.id} className="border-t border-[var(--surface-border)]">
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="font-semibold text-[var(--text-strong)]">{driver.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">{driver.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-strong)]">{driver.activeCount}</td>
                          <td className="px-4 py-3 text-[var(--text-strong)]">{driver.completedCount}</td>
                          <td className="px-4 py-3 text-[var(--text-strong)]">{formatCurrency(driver.collected)}</td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{lastAssignment}</td>
                        </tr>
                      );
                    })}
                    {data.driverRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-muted)]">
                          No drivers assigned yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
                <header className="flex items-center justify-between border-b border-[var(--surface-border)] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-strong)]">Driver approval requests</h3>
                    <p className="text-xs text-[var(--text-strong)]/80">Status updates for drivers submitted for admin review.</p>
                  </div>
                </header>
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                    <tr className="text-xs uppercase tracking-[0.16em]">
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3">Processed</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">Attempts</th>
                      <th className="px-4 py-3 text-right">Resubmit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map((request) => {
                      const submittedAt = format(new Date(request.createdAt), 'd MMM yyyy, h:mma');
                      const processedAt = request.processedAt ? format(new Date(request.processedAt), 'd MMM yyyy, h:mma') : '—';
                      const statusClass =
                        request.status === 'APPROVED'
                          ? 'text-emerald-600'
                          : request.status === 'REJECTED'
                            ? 'text-rose-600'
                            : 'text-amber-600';
                      const canResubmit = request.status === 'REJECTED' && request.rejectionCount < 3;
                      const attemptsLeft = Math.max(0, 3 - request.rejectionCount);
                      return (
                        <tr key={request.id} className="border-t border-[var(--surface-border)]">
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="font-semibold text-[var(--text-strong)]">{request.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">{request.email}</p>
                            </div>
                          </td>
                          <td className={`px-4 py-3 text-sm font-semibold ${statusClass}`}>{formatStatusLabel(request.status)}</td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{submittedAt}</td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{processedAt}</td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">
                            {request.status === 'REJECTED' && request.rejectionReason ? request.rejectionReason : '—'}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-strong)]">
                            <div className="flex flex-col">
                              <span>{request.rejectionCount}/3</span>
                              <span className="text-xs text-[var(--text-muted)]">{attemptsLeft} left</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canResubmit ? (
                              <Link
                                href={`/partner/drivers?requestId=${request.id}&rejections=${request.rejectionCount}`}
                                prefetch={false}
                                className="btn btn-primary btn-xs"
                              >
                                Resubmit
                              </Link>
                            ) : request.status === 'REJECTED' ? (
                              <span className="text-xs text-[var(--text-muted)]">
                                {request.rejectionCount >= 3 ? 'Limit reached' : 'Awaiting admin update'}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {data.requests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-[var(--text-muted)]">
                          No driver requests submitted yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeSection === 'earnings' && featureFlags.partnerTabEarnings ? (
            <section className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                  <h3 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Cash pending settlement</h3>
                  <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(stats.cashPending)}</p>
                  <p className="text-xs text-[var(--text-muted)]">Awaiting handover to QuickWay</p>
                </article>
                <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                  <h3 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Cash settled</h3>
                  <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(stats.cashSettled)}</p>
                  <p className="text-xs text-[var(--text-muted)]">Remitted and reconciled</p>
                </article>
                <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                  <h3 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Invoices paid</h3>
                  <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(stats.invoicesPaid)}</p>
                  <p className="text-xs text-[var(--text-muted)]">Card or online payments received</p>
                </article>
                <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                  <h3 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Invoices pending</h3>
                  <p className="mt-3 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(stats.invoicesPending)}</p>
                  <p className="text-xs text-[var(--text-muted)]">Outstanding or in-progress payments</p>
                </article>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                    <tr className="text-xs uppercase tracking-[0.16em]">
                      <th className="px-4 py-3">Booking</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Cash status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningsTable.map((booking) => (
                      <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                        <td className="px-4 py-3 text-[var(--text-muted)]">#{booking.id.slice(-6)}</td>
                        <td className="px-4 py-3 text-[var(--text-strong)]">{booking.serviceName}</td>
                        <td className="px-4 py-3 text-[var(--text-strong)]">{formatCurrency(booking.netAmount)}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{booking.paymentLabel}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{booking.cashLabel}</td>
                      </tr>
                    ))}
                    {earningsTable.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-muted)]">
                          No earnings recorded yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

        </main>
      </div>
    </div>
  );
}
