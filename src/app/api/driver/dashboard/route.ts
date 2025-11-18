import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getFeatureFlags } from "@/lib/admin-settings";
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

  // Fetch bookings (same query as web driver dashboard)
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

  // Filter bookings
  const assignmentBookings = bookings.filter((booking: DriverBookingItem) => booking.taskStatus !== "COMPLETED");
  const cashBookings = bookings.filter(
    (booking: DriverBookingItem) => booking.cashSettled !== true && (!booking.payment || booking.payment.status === "REQUIRES_PAYMENT"),
  );

  // Calculate KPIs
  const totalJobs = assignmentBookings.length;
  const activeJobs = assignmentBookings.length;
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

  const showAssignmentsEmpty = assignmentBookings.length === 0;
  const showCashEmpty = cashBookings.length === 0;

  return jsonResponse({
    data: {
      assignmentBookings,
      cashBookings,
      totalJobs,
      activeJobs,
      totalValueCents,
      collectedCents,
      pendingCents,
      collectedCount,
      showAssignmentsEmpty,
      showCashEmpty,
    },
    featureFlags: {
      driverTabOverview,
      driverTabAssignments,
      driverTabCash,
    },
  });
}

export function OPTIONS() {
  return noContentResponse();
}
