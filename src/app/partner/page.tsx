import Link from "next/link";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { Briefcase, DollarSign, Users, Wallet } from "lucide-react";
import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";
import { DEFAULT_PARTNER_COMMISSION_SETTING_KEY, parsePercentageSetting } from "../admin/settings/pricingConstants";
import type { PricingAdjustmentConfig } from "@/lib/pricingSettings";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ");
}

export const dynamic = "force-dynamic";

async function loadPartnerDashboard(partnerUserId: string) {
  const partnerRecord = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      commissionPercentage: true,
    },
  });

  if (!partnerRecord) return null;

  const partner = {
    ...partnerRecord,
  };

  const drivers = await prisma.user.findMany({
    where: { partnerId: partner.id },
    select: {
      id: true,
      name: true,
      email: true,
      driverBookings: {
        select: {
          id: true,
          startAt: true,
          taskStatus: true,
          status: true,
          cashCollected: true,
          cashAmountCents: true,
          service: { select: { priceCents: true, name: true } },
        },
        orderBy: { startAt: "desc" },
        take: 20,
      },
    },
  });

  const driverIds = drivers.map((driver) => driver.id);

  const bookingsWhere =
    driverIds.length > 0
      ? {
          OR: [
            { partnerId: partner.id },
            { driverId: { in: driverIds } },
          ],
        }
      : { partnerId: partner.id };

  const [bookings, requests] = await Promise.all([
    prisma.booking.findMany({
      where: bookingsWhere,
      orderBy: { startAt: "desc" },
      take: 30,
      select: {
        id: true,
        startAt: true,
        taskStatus: true,
        status: true,
        cashCollected: true,
        cashAmountCents: true,
        cashSettled: true,
        createdAt: true,
        service: { select: { priceCents: true, name: true } },
        payment: { select: { status: true, amountCents: true } },
      },
    }),
    prisma.partnerDriverRequest.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        processedAt: true,
        rejectionCount: true,
      },
    }),
  ]);

  return {
    partner,
    drivers,
    bookings,
    requests,
  };
}

function getBookingGrossValue(booking: {
  payment?: { status?: string | null; amountCents?: number | null } | null;
  cashCollected?: boolean | null;
  cashAmountCents?: number | null;
  service?: { priceCents?: number | null } | null;
}) {
  if (booking.payment?.status === "PAID") {
    return booking.payment.amountCents ?? booking.service?.priceCents ?? 0;
  }
  if (booking.cashCollected) {
    return booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
  }
  return 0;
}

export default async function PartnerDashboardPage() {
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;
  const partnerRole = session.user?.role;

  if (!partnerUserId || partnerRole !== "PARTNER") {
    return null;
  }

  const dashboard = await loadPartnerDashboard(partnerUserId);

  if (!dashboard) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Partner dashboard</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Your partner account hasn’t been provisioned yet. Contact the admin team to link your drivers.
          </p>
        </header>
        <Link
          href="/admin/partners"
          className="btn btn-muted"
        >
          Go to admin portal
        </Link>
      </div>
    );
  }

  const { partner, drivers, bookings, requests } = dashboard;

  const defaultCommissionSetting = await prisma.adminSetting.findUnique({
    where: { key: DEFAULT_PARTNER_COMMISSION_SETTING_KEY },
    select: { value: true },
  });
  const commissionPercentage = partner.commissionPercentage ?? parsePercentageSetting(defaultCommissionSetting?.value) ?? 100;
  const commissionMultiplier = Math.max(0, Math.min(commissionPercentage, 100)) / 100;

  const pricingAdjustments = await loadPricingAdjustmentConfig();

  type DriverRecord = typeof drivers[number];
  type DriverBookingRecord = DriverRecord["driverBookings"][number];
  type BookingRecord = typeof bookings[number];

  const isBookingSettled = (booking: BookingRecord) => {
    if (booking.payment) {
      return booking.payment.status === "PAID";
    }

    if (booking.cashCollected) {
      return Boolean(booking.cashSettled);
    }

    return false;
  };

  const computeBookingNetBase = (
    booking: BookingRecord,
    grossCents: number,
    adjustments: PricingAdjustmentConfig | null,
  ): number => {
    if (grossCents <= 0) {
      return 0;
    }

    const taxPercentage = adjustments?.taxPercentage ?? 0;
    const stripeFeePercentage = adjustments?.stripeFeePercentage ?? 0;
    const stripeFixedFeeCents = adjustments?.extraFeeAmountCents ?? 0;

    // Reverse the fee calculation: gross = base * (1 + tax% + stripe%) + fixed
    // So: base = (gross - fixed) / (1 + tax% + stripe%)
    const taxDecimal = taxPercentage > 0 ? taxPercentage / 100 : 0;
    const stripeDecimal = stripeFeePercentage > 0 ? stripeFeePercentage / 100 : 0;
    const fixedCents = stripeFixedFeeCents > 0 ? stripeFixedFeeCents : 0;

    if (booking.cashCollected) {
      // For cash: gross = base * (1 + tax%)
      const multiplier = 1 + taxDecimal;
      const baseCents = multiplier > 0 ? Math.round(grossCents / multiplier) : 0;
      return baseCents;
    }

    if (booking.payment?.status === "PAID") {
      const grossBeforeFixed = Math.max(0, grossCents - fixedCents);
      const multiplier = 1 + taxDecimal + stripeDecimal;
      const baseCents = multiplier > 0 ? Math.round(grossBeforeFixed / multiplier) : 0;
      return baseCents;
    }

    return 0;
  };

  const netFromBooking = (booking: BookingRecord) => {
    const gross = getBookingGrossValue(booking);
    if (gross <= 0) {
      return 0;
    }
    const settled = isBookingSettled(booking);
    if (!settled) {
      return 0;
    }

    const netBase = computeBookingNetBase(booking, gross, pricingAdjustments);
    if (netBase <= 0) {
      return 0;
    }

    return Math.round(netBase * commissionMultiplier);
  };

  const totals = bookings.reduce(
    (
      acc: {
        totalNet: number;
        cashPendingGross: number;
        cashSettledGross: number;
        invoicesPaidGross: number;
        invoicesPendingGross: number;
      },
      booking: BookingRecord,
    ) => {
      const net = netFromBooking(booking);
      const gross = getBookingGrossValue(booking);

      acc.totalNet += net;

      if (booking.cashCollected) {
        if (booking.cashSettled) {
          acc.cashSettledGross += gross;
        } else {
          acc.cashPendingGross += gross;
        }
      }

      if (booking.payment) {
        if (booking.payment.status === "PAID") {
          acc.invoicesPaidGross += gross;
        } else {
          acc.invoicesPendingGross += gross;
        }
      }

      return acc;
    },
    {
      totalNet: 0,
      cashPendingGross: 0,
      cashSettledGross: 0,
      invoicesPaidGross: 0,
      invoicesPendingGross: 0,
    },
  );

  const totalDrivers = drivers.length;
  const onDutyDrivers = drivers.filter((driver: DriverRecord) =>
    driver.driverBookings.some((booking: DriverBookingRecord) => booking.taskStatus !== "COMPLETED"),
  ).length;
  const totalAssigned = bookings.length;
  const activeJobs = bookings.filter((booking: BookingRecord) => booking.taskStatus !== "COMPLETED").length;

  const jobStatusMap = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.taskStatus] = (acc[booking.taskStatus] ?? 0) + 1;
    return acc;
  }, {});
  const jobStatus = Object.entries(jobStatusMap).map(([status, count]) => ({
    status,
    count: Number(count),
  }));

  const driverRows = drivers.map((driver: DriverRecord) => {
    const relevantBookings = driver.driverBookings;
    const active = relevantBookings.filter((booking: DriverBookingRecord) => booking.taskStatus !== "COMPLETED");
    const completed = relevantBookings.filter((booking: DriverBookingRecord) => booking.taskStatus === "COMPLETED");
    const collected = relevantBookings.reduce((sum: number, booking: DriverBookingRecord) => {
      if (booking.cashCollected) {
        const gross = booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
        return sum + gross;
      }
      return sum;
    }, 0);
    const latest = relevantBookings[0]?.startAt ?? null;
    const latestIso = latest ? new Date(latest).toISOString() : null;

    return {
      id: driver.id,
      name: driver.name ?? driver.email ?? "Driver",
      email: driver.email ?? "—",
      activeCount: active.length,
      completedCount: completed.length,
      collected,
      latest: latestIso,
    };
  });

  const recentBookings = bookings.slice(0, 10).map((booking: BookingRecord) => ({
    id: booking.id,
    serviceName: booking.service?.name ?? "Service",
    taskStatus: booking.taskStatus,
    netAmount: netFromBooking(booking),
    isPaid: booking.payment?.status === "PAID" || booking.cashCollected,
    paymentStatus: booking.payment?.status ?? null,
    startAt: booking.startAt ? new Date(booking.startAt).toISOString() : booking.createdAt ? new Date(booking.createdAt).toISOString() : null,
    cashCollected: booking.cashCollected,
    cashSettled: booking.cashSettled ?? false,
  }));

  const pendingRequests = requests.filter((request) => request.status === "PENDING");

  const today = new Date();
  const weeklyData: Array<{ day: string; date: string; revenue: number; bookings: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDay(subDays(today, i));
    const dayEnd = endOfDay(dayStart);
    const dayBookings = bookings.filter((booking: BookingRecord) => {
      const referenceDate = booking.startAt ?? booking.createdAt;
      if (!referenceDate) return false;
      const bookedDate = new Date(referenceDate);
      return bookedDate >= dayStart && bookedDate <= dayEnd;
    });
    const dayRevenue = dayBookings.reduce((sum, booking) => sum + netFromBooking(booking), 0);
    weeklyData.push({
      day: format(dayStart, "EEE"),
      date: format(dayStart, "MMM d"),
      revenue: dayRevenue,
      bookings: dayBookings.length,
    });
  }

  const hasRealWeeklyData = weeklyData.some((day) => day.revenue > 0 || day.bookings > 0);
  const demoRevenue = [3200, 2600, 4100, 3800, 4200, 4600, 3500];
  const demoBookings = [5, 4, 7, 6, 8, 9, 5];
  const weeklyDisplayData = hasRealWeeklyData
    ? weeklyData
    : weeklyData.map((day, idx) => ({
        ...day,
        revenue: demoRevenue[idx] ?? 0,
        bookings: demoBookings[idx] ?? 0,
      }));
  const totalWeeklyRevenue = weeklyDisplayData.reduce((sum, day) => sum + day.revenue, 0);
  const totalWeeklyBookings = weeklyDisplayData.reduce((sum, day) => sum + day.bookings, 0);
  const averageDailyRevenue = weeklyDisplayData.length > 0 ? totalWeeklyRevenue / weeklyDisplayData.length : 0;

  const statCards = [
    {
      label: "Total earnings",
      value: formatCurrency(totals.totalNet),
      sublabel: "Partner share across all jobs",
      icon: <DollarSign className="h-6 w-6 text-white" />,
      iconBg: "bg-[var(--primary-gradient)]",
    },
    {
      label: "Active jobs",
      value: activeJobs,
      sublabel: `${totalAssigned} assigned overall`,
      icon: <Briefcase className="h-6 w-6 text-white" />,
      iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
    },
    {
      label: "Cash pending",
      value: formatCurrency(totals.cashPendingGross),
      sublabel: "Awaiting settlement",
      icon: <Wallet className="h-6 w-6 text-white" />,
      iconBg: "bg-gradient-to-br from-amber-500 to-amber-600",
    },
    {
      label: "Drivers on duty",
      value: `${onDutyDrivers}/${totalDrivers}`,
      sublabel: `${Math.round(totalDrivers ? (onDutyDrivers / totalDrivers) * 100 : 0)}% active`,
      icon: <Users className="h-6 w-6 text-white" />,
      iconBg: "bg-gradient-to-br from-teal-500 to-teal-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-[var(--brand-primary)]/15 via-[var(--brand-primary)]/10 to-transparent p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand-primary)]">Partner dashboard</p>
            <h1 className="text-3xl font-semibold text-[var(--text-strong)]">{partner.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/70 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active since {format(new Date(partner.createdAt), "d MMM yyyy")}
              </span>
              {partner.email ? (
                <span className="rounded-full border border-[var(--surface-border)] bg-white/70 px-3 py-1">{partner.email}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/partners" className="btn btn-muted">
              View in admin portal
            </Link>
            <Link href="mailto:support@quickway.app?subject=Partner%20support%20request" className="btn btn-primary">
              Contact support
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{card.value}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{card.sublabel}</p>
              </div>
              <div className={`rounded-lg p-3 ${card.iconBg}`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Revenue Breakdown</h2>
            <p className="text-xs text-[var(--text-muted)]">Your earnings after QuickWay commission.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-secondary)] px-4 py-1.5 text-xs font-medium text-[var(--text-medium)]">
            <span className="text-[var(--text-muted)]">Commission applied</span>
            <span className="text-[var(--brand-primary)]">{commissionPercentage}%</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">NET EARNINGS</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-label)]">Partner share</div>
              <div className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totals.totalNet)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Across all bookings</div>
            </div>
          </div>

          <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">CASH PENDING</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-label)]">Awaiting settlement</div>
              <div className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totals.cashPendingGross)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Driver collections not yet handed over</div>
            </div>
          </div>

          <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">CASH SETTLED</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-label)]">Reconciled recently</div>
              <div className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totals.cashSettledGross)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Handed over to QuickWay</div>
            </div>
          </div>

          <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">PAID INVOICES</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-label)]">Online / card revenue</div>
              <div className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totals.invoicesPaidGross)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Captured via payment gateway</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-strong)]">Revenue Overview</h3>
              <p className="text-xs text-[var(--text-muted)]">Daily net earnings for the last 7 days</p>
            </div>
            {!hasRealWeeklyData ? (
              <span className="rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-[var(--text-muted)]">
                DEMO DATA
              </span>
            ) : null}
          </div>
          <div className="mb-4 grid gap-3 text-xs text-[var(--text-muted)] sm:grid-cols-3">
            <div>
              <div className="text-[var(--text-medium)]">Total revenue (7 days)</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{formatCurrency(totalWeeklyRevenue)}</div>
            </div>
            <div>
              <div className="text-[var(--text-medium)]">Avg per day</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{formatCurrency(averageDailyRevenue)}</div>
            </div>
            <div>
              <div className="text-[var(--text-medium)]">Bookings (7 days)</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{totalWeeklyBookings}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex h-48 items-end justify-between gap-2">
              {weeklyDisplayData.map((day, idx) => {
                const maxRevenue = Math.max(...weeklyDisplayData.map((d) => d.revenue));
                const maxBookings = Math.max(...weeklyDisplayData.map((d) => d.bookings));
                const useRevenue = maxRevenue > 0;
                const value = useRevenue ? day.revenue : day.bookings;
                const maxValue = useRevenue ? maxRevenue : maxBookings;
                const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const height = value > 0 ? Math.max(12, heightPercent) : 0;
                const gradient = idx % 2 === 0 ? "from-green-400 to-green-600" : "from-emerald-400 to-emerald-600";

                return (
                  <div key={day.day} className="flex flex-1 justify-center">
                    {value > 0 && (
                      <div
                        className={`w-8 rounded-t-lg bg-gradient-to-t ${gradient} transition-all hover:opacity-80`}
                        style={{ height: `${height}%` }}
                        title={useRevenue
                          ? `${day.day}: ${formatCurrency(day.revenue)} (${day.bookings} bookings)`
                          : `${day.day}: ${day.bookings} bookings (no revenue yet)`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              {weeklyDisplayData.map((day) => (
                <div key={`label-${day.day}`} className="flex-1 text-center">
                  <div className="text-xs font-medium text-[var(--text-medium)]">{day.day}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{day.date}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-gradient-to-r from-green-400 to-green-600" />
              <span className="text-[var(--text-muted)]">Even Days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <span className="text-[var(--text-muted)]">Odd Days</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-strong)]">Job status</h3>
          <p className="text-xs text-[var(--text-muted)]">Live view of task distribution.</p>
          <ul className="mt-4 space-y-3 text-sm">
            {jobStatus.length > 0 ? (
              jobStatus.map((item) => (
                <li key={item.status} className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] px-3 py-2">
                  <span className="font-medium text-[var(--text-medium)]">{formatStatusLabel(item.status)}</span>
                  <span className="text-sm font-semibold text-[var(--text-strong)]">{item.count}</span>
                </li>
              ))
            ) : (
              <li className="rounded-xl border border-dashed border-[var(--surface-border)] px-3 py-4 text-center text-[var(--text-muted)]">
                No bookings recorded yet.
              </li>
            )}
          </ul>

          <div className="mt-6 rounded-2xl bg-[var(--surface-secondary)]/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]">Driver summary</p>
                <p className="text-2xl font-semibold text-[var(--text-strong)]">{totalDrivers}</p>
              </div>
              <div className="rounded-full bg-[var(--brand-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                {onDutyDrivers} on duty
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Top performers in the last week.</p>
            <div className="mt-4 space-y-3">
              {driverRows.slice(0, 3).map((driver) => (
                <div key={driver.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--card-bg)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[var(--text-strong)]">{driver.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{driver.completedCount} completed</p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-strong)]">{formatCurrency(driver.collected)}</p>
                  </div>
                </div>
              ))}
              {driverRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--surface-border)] px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                  No drivers assigned yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-strong)]">Recent bookings</h3>
              <p className="text-xs text-[var(--text-muted)]">Latest assignments with payout details.</p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                <tr className="text-xs uppercase tracking-[0.16em]">
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => {
                  const scheduled = booking.startAt ? format(new Date(booking.startAt), "d MMM, h:mma") : "—";
                  const taskBadgeClass =
                    booking.taskStatus === "COMPLETED"
                      ? "bg-emerald-500/15 text-emerald-700"
                      : booking.taskStatus === "IN_PROGRESS"
                        ? "bg-amber-500/15 text-amber-700"
                        : "bg-[var(--brand-accent)]/15 text-[var(--brand-primary)]";
                  return (
                    <tr key={booking.id} className="border-t border-[var(--surface-border)]">
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--text-strong)]">#{booking.id.slice(-6)}</span>
                          <span className="text-xs text-[var(--text-muted)]">{scheduled}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-strong)]">{booking.serviceName}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-strong)]">{formatCurrency(booking.netAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${taskBadgeClass}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {formatStatusLabel(booking.taskStatus)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-muted)]">
                      No bookings assigned yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-strong)]">Driver requests</h3>
              <p className="text-xs text-[var(--text-muted)]">Track approvals and outstanding actions.</p>
            </div>
            {pendingRequests.length > 0 ? (
              <span className="rounded-full bg-[var(--brand-primary)]/15 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                {pendingRequests.length} pending
              </span>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {requests.length > 0 ? (
              requests.slice(0, 4).map((request) => {
                const submittedAt = format(new Date(request.createdAt), "d MMM yyyy, h:mma");
                const statusClass =
                  request.status === "APPROVED"
                    ? "text-emerald-600"
                    : request.status === "REJECTED"
                      ? "text-rose-600"
                      : "text-amber-600";
                return (
                  <div key={request.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[var(--text-strong)]">{request.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{request.email}</p>
                      </div>
                      <span className={`text-xs font-semibold ${statusClass}`}>{formatStatusLabel(request.status)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                      <span>Submitted {submittedAt}</span>
                      {request.rejectionReason ? <span>Notes: {request.rejectionReason}</span> : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--surface-border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                No driver requests yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
