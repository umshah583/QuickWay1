import Link from "next/link";
import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";
import PartnerDashboardClient, { type PartnerDashboardData } from "./PartnerDashboardClient";
import { DEFAULT_PARTNER_COMMISSION_SETTING_KEY, parsePercentageSetting } from "../admin/settings/pricingConstants";

export const dynamic = "force-dynamic";

async function loadPartnerDashboard(partnerUserId: string) {
  const partner = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      commissionPercentage: true,
    },
  });

  if (!partner) return null;

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

  type DriverRecord = typeof drivers[number];
  type DriverBookingRecord = DriverRecord["driverBookings"][number];
  type BookingRecord = typeof bookings[number];
  type RequestRecord = typeof requests[number];

  const netFromBooking = (booking: BookingRecord) => {
    const gross = getBookingGrossValue(booking);
    if (gross <= 0) {
      return 0;
    }
    return Math.round(gross * commissionMultiplier);
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

  const stats: PartnerDashboardData["stats"] = {
    totalDrivers: drivers.length,
    onDutyDrivers: drivers.filter((driver: DriverRecord) =>
      driver.driverBookings.some((booking: DriverBookingRecord) => booking.taskStatus !== "COMPLETED"),
    ).length,
    totalAssigned: bookings.length,
    activeJobs: bookings.filter((booking: BookingRecord) => booking.taskStatus !== "COMPLETED").length,
    completedJobs: bookings.filter((booking: BookingRecord) => booking.taskStatus === "COMPLETED").length,
    totalEarnings: totals.totalNet,
    cashPending: totals.cashPendingGross,
    cashSettled: totals.cashSettledGross,
    invoicesPaid: totals.invoicesPaidGross,
    invoicesPending: totals.invoicesPendingGross,
  };

  const jobStatusMap = bookings.reduce<Record<string, number>>((acc: Record<string, number>, booking: BookingRecord) => {
    acc[booking.taskStatus] = (acc[booking.taskStatus] ?? 0) + 1;
    return acc;
  }, {});

  const jobStatus: PartnerDashboardData["jobStatus"] = Object.entries(jobStatusMap).map(([status, count]) => ({
    status,
    count: Number(count),
  }));

  const driverRows: PartnerDashboardData["driverRows"] = drivers.map((driver: DriverRecord) => {
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

  const recentBookings: PartnerDashboardData["recentBookings"] = bookings.slice(0, 30).map((booking: BookingRecord) => ({
    id: booking.id,
    serviceName: booking.service?.name ?? "Service",
    taskStatus: booking.taskStatus,
    netAmount: netFromBooking(booking),
    grossAmount: getBookingGrossValue(booking),
    isPaid: booking.payment?.status === "PAID" || booking.cashCollected,
    paymentStatus: booking.payment?.status ?? null,
    startAt: booking.startAt ? new Date(booking.startAt).toISOString() : null,
    cashCollected: booking.cashCollected,
    cashSettled: booking.cashSettled ?? false,
  }));

  const requestRows: PartnerDashboardData["requests"] = requests.map((request: RequestRecord) => ({
    id: request.id,
    name: request.name,
    email: request.email,
    status: request.status,
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt.toISOString(),
    processedAt: request.processedAt ? request.processedAt.toISOString() : null,
    rejectionCount: request.rejectionCount,
  }));

  const data: PartnerDashboardData = {
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      createdAt: new Date(partner.createdAt).toISOString(),
    },
    stats,
    jobStatus,
    driverRows,
    recentBookings,
    requests: requestRows,
  };

  return <PartnerDashboardClient data={data} />;
}
