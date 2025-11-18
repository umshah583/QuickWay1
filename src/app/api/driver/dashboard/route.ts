import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getFeatureFlags, getDriverDutySettings } from "@/lib/admin-settings";
import type { Prisma } from "@prisma/client";

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

export async function GET(req: Request) {
  // Verify driver authentication
  const session = await getMobileUserFromRequest(req);
  if (!session || session.role !== "DRIVER") {
    return errorResponse("Unauthorized", 401);
  }

  const driverId = session.sub;
  const featureFlags = await getFeatureFlags();
  const { driverTabOverview, driverTabAssignments, driverTabCash } = featureFlags;
  const dutySettings = await getDriverDutySettings(driverId);

  // Fetch incomplete/unsettled bookings (for assignments and cash tabs)
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
      payment: true,
    },
    orderBy: { startAt: "desc" },
  }) as DriverBookingItem[];

  // Filter bookings
  const assignmentBookings = bookings.filter((booking: DriverBookingItem) => booking.taskStatus !== "COMPLETED");
  const cashBookings = bookings.filter(
    (booking: DriverBookingItem) =>
      booking.cashSettled !== true &&
      booking.cashCollected === true &&
      (!booking.payment || booking.payment.status === "REQUIRES_PAYMENT"),
  );

  // Calculate KPIs (including completed tasks)
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

  // Total collected amount (cash + online) for completed jobs
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

  return jsonResponse({
    data: {
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
    },
    featureFlags: {
      driverTabOverview,
      driverTabAssignments,
      driverTabCash,
    },
    dutySettings,
  });
}

export function OPTIONS() {
  return noContentResponse();
}
