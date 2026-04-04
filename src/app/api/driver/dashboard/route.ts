import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { getFeatureFlags, getDriverDutySettings } from "@/lib/admin-settings";
import type { Prisma } from "@prisma/client";

type DriverBookingItem = Prisma.BookingGetPayload<{
  include: {
    Service: true;
    User_Booking_userIdToUser: true;
    Payment: true;
  };
}> & {
  locationLabel: string | null;
  locationCoordinates: string | null;
};

export async function GET(req: Request) {
  console.log(`[Dashboard API] 📨 Incoming request: ${req.method} ${req.url}`);
  
  // Verify driver authentication
  const session = await getMobileUserFromRequest(req);
  if (!session || session.role !== "DRIVER") {
    console.log(`[Dashboard API] ❌ Auth failed - session: ${!!session}, role: ${session?.role}`);
    return errorResponse("Unauthorized", 401);
  }

  const driverId = session.sub;
  console.log(`[Dashboard API] ✅ Authenticated driver: ${driverId} (${session.email || 'no email'})`);
  console.log(`[Dashboard API] 📊 Fetching dashboard data...`);
  
  const featureFlags = await getFeatureFlags();
  const { driverTabOverview, driverTabAssignments, driverTabCash } = featureFlags;
  const dutySettings = await getDriverDutySettings(driverId);

  // Fetch incomplete/unsettled bookings (for assignments and cash tabs)
  const bookings = await prisma.booking.findMany({
    where: {
      driverId,
      OR: [
        {
          // Active assignments (incomplete tasks) - exclude online payments
          AND: [
            { driverId: { not: null } }, // Must have a driver assigned
            {
              taskStatus: {
                not: "COMPLETED",
              },
            },
            {
              // Exclude bookings that already have online payments (STRIPE)
              OR: [
                { Payment: { is: null } },
                { Payment: { provider: { not: "STRIPE" } } },
              ],
            },
          ],
        },
        {
          // Unsettled cash bookings (cash collected but not settled)
          AND: [
            { cashCollected: true },
            { cashSettled: { not: true } },
          ],
        },
        {
          // Cash collection tasks - only bookings that need cash settlement
          AND: [
            {
              cashSettled: {
                not: true,
              },
            },
            {
              OR: [
                { Payment: { is: null } },
                { Payment: { status: "REQUIRES_PAYMENT" } },
                { Payment: { provider: "CASH" } }, // Only include cash payments
              ],
            },
          ],
        },
      ],
    },
    include: {
      Service: true,
      User_Booking_userIdToUser: true,
      Payment: true,
    },
    orderBy: { startAt: "asc" },
  }) as DriverBookingItem[];

  console.log(`[Driver Dashboard] Found ${bookings.length} bookings for driver ${driverId}`);
  console.log(`[Driver Dashboard] Booking details:`, bookings.map(b => ({
    id: b.id,
    taskStatus: b.taskStatus,
    status: b.status,
    serviceName: b.Service?.name,
    startAt: b.startAt,
    userId: b.userId,
    driverId: b.driverId,
    isSpotOrder: b.userId === b.driverId
  })));

  // Filter out spot bookings from regular bookings for separate display
  const spotBookings = bookings.filter(booking => booking.userId === booking.driverId);
  const regularBookings = bookings.filter(booking => booking.userId !== booking.driverId);

  console.log(`[Driver Dashboard] Found ${spotBookings.length} spot bookings and ${regularBookings.length} regular bookings`);

  // Fetch completed tasks for overview statistics
  const completedTasks = await prisma.booking.findMany({
    where: {
      driverId,
      taskStatus: "COMPLETED",
    },
    include: {
      Service: true,
      Payment: true,
    },
    orderBy: { startAt: "desc" },
  }) as DriverBookingItem[];

  console.log(`[Driver Dashboard] Found ${completedTasks.length} completed tasks for driver ${driverId}`);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const completedJobsThisMonth = await prisma.booking.count({
    where: {
      driverId,
      taskStatus: "COMPLETED",
      taskCompletedAt: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
  });

  // Filter bookings for assignments (excluding spot bookings)
  const assignmentBookings = regularBookings.filter((booking: DriverBookingItem) => 
    booking.taskStatus === "ASSIGNED" || booking.taskStatus === "IN_PROGRESS"
  );
  const cashBookings = regularBookings.filter(
    (booking: DriverBookingItem) =>
      booking.cashSettled !== true &&
      booking.cashCollected === true &&
      (!booking.Payment || booking.Payment.status === "REQUIRES_PAYMENT"),
  );

  // Calculate KPIs (including completed tasks)
  const totalJobs = assignmentBookings.length;
  const activeJobs = assignmentBookings.filter((b: DriverBookingItem) => b.taskStatus === "IN_PROGRESS").length;
  const completedJobs = completedTasks.length;
  
  const totalValueCents = assignmentBookings.reduce(
    (sum: number, booking: DriverBookingItem) => sum + (booking.Service?.priceCents ?? 0),
    0,
  );
  const collectedCents = assignmentBookings
    .filter((booking: DriverBookingItem) => booking.cashCollected)
    .reduce(
      (sum: number, booking: DriverBookingItem) => sum + (booking.cashAmountCents ?? booking.Service?.priceCents ?? 0),
      0,
    );
  const pendingCents = Math.max(totalValueCents - collectedCents, 0);
  const collectedCount = assignmentBookings.filter((booking: DriverBookingItem) => booking.cashCollected).length;

  // Total collected amount (cash + online) for completed jobs
  const getBookingValue = (booking: DriverBookingItem) =>
    booking.cashAmountCents ?? booking.Payment?.amountCents ?? booking.Service?.priceCents ?? 0;

  const isBookingPaid = (booking: DriverBookingItem) =>
    booking.cashCollected === true || booking.status === "PAID" || booking.Payment?.status === "PAID";

  const totalCashCollected = completedTasks.reduce((sum: number, booking: DriverBookingItem) => {
    if (!isBookingPaid(booking)) {
      return sum;
    }
    return sum + getBookingValue(booking);
  }, 0);

  const showAssignmentsEmpty = assignmentBookings.length === 0 && spotBookings.length === 0;
  const showCashEmpty = cashBookings.length === 0;

  console.log(`[Driver Dashboard] Response summary:`, {
    assignmentBookingsCount: assignmentBookings.length,
    spotBookingsCount: spotBookings.length,
    cashBookingsCount: cashBookings.length,
    showAssignmentsEmpty,
    showCashEmpty
  });

  const response = {
    data: {
      assignmentBookings: [
        ...assignmentBookings.map(booking => ({
          ...booking,
          userId: booking.userId,
          driverId: booking.driverId,
          // Transform Service to service (lowercase) for mobile app compatibility
          service: booking.Service,
          Service: undefined, // Remove the uppercase version
          user: booking.User_Booking_userIdToUser,
          User_Booking_userIdToUser: undefined, // Remove the original
          payment: booking.Payment,
          Payment: undefined, // Remove the original
        })),
        ...spotBookings.map(booking => ({
          ...booking,
          userId: booking.userId,
          driverId: booking.driverId,
          // Transform Service to service (lowercase) for mobile app compatibility
          service: booking.Service,
          Service: undefined, // Remove the uppercase version
          user: booking.User_Booking_userIdToUser,
          User_Booking_userIdToUser: undefined, // Remove the original
          payment: booking.Payment,
          Payment: undefined, // Remove the original
        }))
      ], // Combine regular and spot bookings with identification fields
      cashBookings: cashBookings.map(booking => ({
        ...booking,
        // Transform Service to service (lowercase) for mobile app compatibility
        service: booking.Service,
        Service: undefined, // Remove the uppercase version
        user: booking.User_Booking_userIdToUser,
        User_Booking_userIdToUser: undefined, // Remove the original
        payment: booking.Payment,
        Payment: undefined, // Remove the original
      })),
      totalJobs,
      activeJobs,
      completedJobs,
      totalValueCents,
      collectedCents,
      pendingCents,
      collectedCount,
      completedJobsThisMonth,
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
  };

  console.log(`[Dashboard API] 📤 Sending response with ${spotBookings.length} spot bookings included in assignments`);
  console.log(`[Dashboard API] Response:`, response);

  return jsonResponse(response);
}

export function OPTIONS() {
  return noContentResponse();
}
