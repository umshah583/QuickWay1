import { requirePartnerSession } from "@/lib/partner-auth";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
import prisma from "@/lib/prisma";
import { Briefcase, MapPin, Clock, CheckCircle, AlertCircle, DollarSign } from "lucide-react";

function formatTimestamp(date?: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const dynamic = "force-dynamic";

export default async function PartnerAssignmentsPage() {
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;

  const partner = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: { id: true, name: true },
  });

  if (!partner) {
    return (
      <div className="px-4 py-10">
        <p className="text-sm text-rose-600">Partner profile not found.</p>
      </div>
    );
  }

  // Get all drivers under this partner
  const drivers = await prisma.user.findMany({
    where: {
      partnerId: partner.id,
      role: "DRIVER",
    },
    select: { id: true, name: true },
  });

  const driverIds = drivers.map((d) => d.id);
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }); // YYYY-MM-DD

  type SubscriptionForAssignments = {
    id: string;
    pricePaidCents: number;
    preferredWashDates: string[];
    user: { name: string | null } | null;
    package: { name: string | null } | null;
    driver: { name: string | null } | null;
  };

  type DailySubscriptionAssignment = {
    subscriptionId: string;
    date: string;
    subscription: SubscriptionForAssignments;
  };

  type PrismaWithSubscriptions = typeof prisma & {
    packageSubscription: {
      findMany: (args: unknown) => Promise<SubscriptionForAssignments[]>;
    };
    subscriptionDailyDriver: {
      findMany: (args: unknown) => Promise<DailySubscriptionAssignment[]>;
    };
  };

  const prismaWithSubs = prisma as PrismaWithSubscriptions;

  const [
    rawAssignments,
    completedToday,
    earningsToday,
    dailySubAssignments,
    defaultSubSubscriptions,
  ] = await Promise.all([
    // Pending bookings (assignments) for this partner
    prisma.booking.findMany({
      where: {
        OR: [
          { partnerId: partner.id },
          ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
        ],
        status: { in: ["ASSIGNED", "PENDING"] },
        taskStatus: { not: "COMPLETED" },
      },
      select: {
        id: true,
        startAt: true,
        updatedAt: true,
        locationLabel: true,
        status: true,
        taskStatus: true,
        taskStartedAt: true,
        taskCompletedAt: true,
        vehicleCount: true,
        vehiclePlate: true,
        cashAmountCents: true,
        service: {
          select: {
            name: true,
            priceCents: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
        driver: {
          select: {
            name: true,
          },
        },
        payment: {
          select: {
            amountCents: true,
          },
        },
      },
      orderBy: {
        startAt: "asc",
      },
    } as any),
    // Completed bookings for today
    prisma.booking.count({
      where: {
        OR: [
          { partnerId: partner.id },
          ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
        ],
        status: "PAID",
        updatedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),
    // Total earnings from completed bookings today
    prisma.payment.aggregate({
      where: {
        booking: {
          OR: [
            { partnerId: partner.id },
            ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
          ],
          status: "PAID",
          updatedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      },
      _sum: {
        amountCents: true,
      },
    }),
    // Daily overrides: specific driver assigned for this subscription + today
    prismaWithSubs.subscriptionDailyDriver.findMany({
      where: {
        date: todayIso,
        driverId: driverIds.length > 0 ? { in: driverIds } : undefined,
      },
      select: {
        subscriptionId: true,
        date: true,
        subscription: {
          select: {
            id: true,
            pricePaidCents: true,
            preferredWashDates: true,
            user: { select: { name: true } },
            package: { select: { name: true } },
            driver: { select: { name: true } },
          },
        },
      },
    }),
    // Default subscriptions where full schedule driver is under this partner and today is in schedule
    prismaWithSubs.packageSubscription.findMany({
      where: {
        driverId: driverIds.length > 0 ? { in: driverIds } : undefined,
        preferredWashDates: { has: todayIso },
      },
      select: {
        id: true,
        pricePaidCents: true,
        preferredWashDates: true,
        user: { select: { name: true } },
        package: { select: { name: true } },
        driver: { select: { name: true } },
      },
    }),
  ]);

  const assignments = rawAssignments as any[];
  const totalEarningsToday = (earningsToday as any)._sum?.amountCents || 0;

  const overrideIds = new Set(dailySubAssignments.map((a) => a.subscriptionId));
  const directSubscriptions = defaultSubSubscriptions.filter((s) => !overrideIds.has(s.id));

  const subscriptionTasks = [
    ...dailySubAssignments.map((row) => {
      const sub = row.subscription;
      const dayCount = sub.preferredWashDates.length || 1;
      const perDayCents = Math.round(sub.pricePaidCents / dayCount);
      return {
        id: `${sub.id}:${row.date}`,
        packageName: sub.package?.name ?? "Subscription",
        customerName: sub.user?.name ?? "Customer",
        driverName: sub.driver?.name ?? "Driver",
        amountCents: perDayCents,
      };
    }),
    ...directSubscriptions.map((sub) => {
      const dayCount = sub.preferredWashDates.length || 1;
      const perDayCents = Math.round(sub.pricePaidCents / dayCount);
      return {
        id: `${sub.id}:${todayIso}`,
        packageName: sub.package?.name ?? "Subscription",
        customerName: sub.user?.name ?? "Customer",
        driverName: sub.driver?.name ?? "Driver",
        amountCents: perDayCents,
      };
    }),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Assignments</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage your drivers' pending bookings and assignments
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-strong)]">{assignments.length}</p>
              <p className="text-xs text-[var(--text-muted)]">Pending Assignments</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-strong)]">{completedToday}</p>
              <p className="text-xs text-[var(--text-muted)]">Completed Today</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
              <DollarSign className="h-5 w-5 text-[var(--brand-primary)]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-strong)]">AED {totalEarningsToday}</p>
              <p className="text-xs text-[var(--text-muted)]">Earned Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)] px-6 py-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
          <h3 className="mt-4 text-lg font-medium text-[var(--text-strong)]">No pending assignments</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            All assignments are currently completed or in progress.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Driver</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Scheduled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Timeline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {assignments.map((assignment) => {
                  const vehicleCount = assignment.vehicleCount ?? 1;
                  const baseServiceCents = assignment.service?.priceCents ?? 0;
                  const bookingAmountCents =
                    assignment.cashAmountCents && assignment.cashAmountCents > 0
                      ? assignment.cashAmountCents
                      : assignment.payment?.amountCents && assignment.payment.amountCents > 0
                      ? assignment.payment.amountCents
                      : baseServiceCents * vehicleCount;

                  return (
                    <tr key={assignment.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-[var(--text-strong)]">{vehicleCount > 1 ? "Multi services" : assignment.service.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">ID: {assignment.id.slice(0, 8)}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            Vehicles: {vehicleCount}
                            {assignment.vehiclePlate ? ` • Plates: ${assignment.vehiclePlate}` : ""}
                          </p>
                        </div>
                      </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-[var(--text-strong)]">{assignment.user.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-[var(--text-medium)]">
                        {assignment.driver?.name || "Unassigned"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-medium)]">{assignment.locationLabel || "N/A"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-medium)]">
                          {new Date(assignment.startAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[var(--text-strong)]">AED {Math.round(bookingAmountCents / 100)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-xs text-[var(--text-medium)]">
                        <p>
                          <span className="font-medium text-[var(--text-strong)]">Started:</span>{" "}
                          {assignment.taskStartedAt
                            ? formatTimestamp(assignment.taskStartedAt)
                            : assignment.taskStatus === "IN_PROGRESS"
                            ? "In progress"
                            : "Not started"}
                        </p>
                        <p>
                          <span className="font-medium text-[var(--text-strong)]">Completed:</span>{" "}
                          {assignment.taskCompletedAt
                            ? formatTimestamp(assignment.taskCompletedAt)
                            : assignment.taskStatus === "COMPLETED"
                            ? formatTimestamp(assignment.updatedAt) ?? "Completed"
                            : "—"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          assignment.taskStatus === "IN_PROGRESS"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {assignment.taskStatus === "IN_PROGRESS"
                          ? "In Progress"
                          : assignment.status === "ASSIGNED"
                          ? "Assigned"
                          : "Pending"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Today's subscription washes */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
        <div className="border-b border-[var(--surface-border)] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-strong)]">Today's subscription washes</h2>
            <p className="text-xs text-[var(--text-muted)]">Subscription visits scheduled for today and assigned to your drivers.</p>
          </div>
        </div>
        {subscriptionTasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-[var(--text-muted)]">
            No subscription washes assigned to your drivers for today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Package</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Driver</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Daily value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {subscriptionTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                    <td className="px-6 py-3 text-sm text-[var(--text-strong)]">{task.packageName}</td>
                    <td className="px-6 py-3 text-sm text-[var(--text-medium)]">{task.customerName}</td>
                    <td className="px-6 py-3 text-sm text-[var(--text-medium)]">{task.driverName}</td>
                    <td className="px-6 py-3 text-sm text-[var(--text-strong)]">AED {Math.round(task.amountCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
