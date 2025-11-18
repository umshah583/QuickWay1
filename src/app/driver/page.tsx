import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireDriverSession } from "@/lib/driver-auth";
import { getFeatureFlags } from "@/lib/admin-settings";
import DriverDashboardAutoRefresh from "./DriverDashboardAutoRefresh";
import DriverDashboardClient from "./DriverDashboardClient";

export const dynamic = "force-dynamic";

type DriverBookingItem = Prisma.BookingGetPayload<{
  include: {
    service: true;
    user: true;
    payment: true;
  };
}> & {
  locationLabel: string | null;
  locationCoordinates: string | null;
};

export default async function DriverDashboardPage() {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const featureFlags = await getFeatureFlags();
  const { driverTabOverview, driverTabAssignments, driverTabCash } = featureFlags;

  const bookings = await prisma.booking.findMany({
    where: {
      driverId,
      OR: [
        {
          taskStatus: {
            not: "COMPLETED",
          },
        },
        {
          AND: [
            {
              cashSettled: {
                not: true,
              },
            },
            {
              OR: [
                { payment: { is: null } },
                { payment: { is: { status: "REQUIRES_PAYMENT" } } },
              ],
            },
          ],
        },
      ],
    },
    include: {
      service: true,
      user: true,
      payment: true,
    },
    orderBy: { startAt: "asc" },
  }) as DriverBookingItem[];

  // Fetch completed tasks for overview statistics
  const completedTasks = await prisma.booking.findMany({
    where: {
      driverId,
      taskStatus: "COMPLETED",
    },
    include: {
      service: true,
      user: true,
      payment: true,
    },
    orderBy: { startAt: "desc" },
  }) as DriverBookingItem[];

  const assignmentBookings = bookings.filter((booking: DriverBookingItem) => booking.taskStatus !== "COMPLETED");
  const cashBookings = bookings.filter(
    (booking: DriverBookingItem) => booking.cashSettled !== true && (!booking.payment || booking.payment.status === "REQUIRES_PAYMENT"),
  );

  const allBookings = [...bookings, ...completedTasks];
  const totalJobs = assignmentBookings.length;
  const activeJobs = assignmentBookings.filter((b: DriverBookingItem) => b.taskStatus === "IN_PROGRESS").length;
  const completedJobs = completedTasks.length;
  const totalValueCents = assignmentBookings.reduce(
    (sum: number, booking: DriverBookingItem) => sum + (booking.service?.priceCents ?? 0),
    0,
  );
  const collectedCents = assignmentBookings
    .filter((booking: DriverBookingItem) => booking.cashCollected)
    .reduce(
      (sum: number, booking: DriverBookingItem) => sum + (booking.cashAmountCents ?? booking.service?.priceCents ?? 0),
      0,
    );
  const pendingCents = Math.max(totalValueCents - collectedCents, 0);
  const collectedCount = assignmentBookings.filter((booking: DriverBookingItem) => booking.cashCollected).length;

  const getBookingValue = (booking: DriverBookingItem) =>
    booking.cashAmountCents ?? booking.payment?.amountCents ?? booking.service?.priceCents ?? 0;

  const isBookingPaid = (booking: DriverBookingItem) =>
    booking.cashCollected === true || booking.status === "PAID" || booking.payment?.status === "PAID";

  const totalCashCollected = completedTasks.reduce((sum: number, booking: DriverBookingItem) => {
    if (!isBookingPaid(booking)) {
      return sum;
    }
    return sum + getBookingValue(booking);
  }, 0);

  const showAssignmentsEmpty = assignmentBookings.length === 0;
  const showCashEmpty = cashBookings.length === 0;

  const data = {
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
  };

  return (
    <>
      <DriverDashboardAutoRefresh />
      <DriverDashboardClient
        data={data}
        featureFlags={{ driverTabOverview, driverTabAssignments, driverTabCash }}
      />
    </>
  );
}
