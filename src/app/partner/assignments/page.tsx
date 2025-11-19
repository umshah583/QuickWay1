import { requirePartnerSession } from "@/lib/partner-auth";
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

  // Get pending bookings (assignments) for this partner
  const assignments = await prisma.booking.findMany({
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
    },
    orderBy: {
      startAt: "asc",
    },
  });

  // Get completed bookings for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const completedToday = await prisma.booking.count({
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
  });

  // Calculate total earnings from completed bookings today
  const earningsToday = await prisma.payment.aggregate({
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
  });

  const totalEarningsToday = earningsToday._sum?.amountCents || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Assignments</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage your drivers&apos; pending bookings and assignments
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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Scheduled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Timeline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-[var(--text-strong)]">{assignment.service.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">ID: {assignment.id.slice(0, 8)}</p>
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
                      <p className="text-sm font-medium text-[var(--text-strong)]">
                        AED {assignment.service.priceCents / 100}
                      </p>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
