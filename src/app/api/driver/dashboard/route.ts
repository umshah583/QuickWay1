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

  // Fetch subscription tasks for today
  const today = new Date().toISOString().split('T')[0];
  console.log(`[Driver Dashboard] Fetching subscription tasks for driver ${driverId}, today: ${today}`);
  
  // First, get existing daily driver records for today
  const existingDailyTasks = await prisma.subscriptionDailyDriver.findMany({
    where: {
      driverId,
      date: today,
    },
    include: {
      PackageSubscription: {
        include: {
          MonthlyPackage: true,
          User_PackageSubscription_userIdToUser: true,
        },
      },
    },
    orderBy: { taskStartedAt: 'asc' },
  });

  console.log(`[Driver Dashboard] Found ${existingDailyTasks.length} existing daily tasks for today`);

  // Get subscription IDs from existing tasks to avoid duplicates
  const existingSubscriptionIds = new Set(existingDailyTasks.map(t => t.subscriptionId));
  console.log(`[Driver Dashboard] Existing subscription IDs:`, Array.from(existingSubscriptionIds));

  // Debug: Check all subscriptions for this driver regardless of date
  const allDriverSubscriptions = await prisma.packageSubscription.findMany({
    where: {
      driverId,
    },
    select: {
      id: true,
      status: true,
      washesRemaining: true,
      startDate: true,
      endDate: true,
      preferredWashDates: true,
      driverId: true,
    },
  });
  console.log(`[Driver Dashboard] ALL subscriptions for driver ${driverId}:`, allDriverSubscriptions);
  console.log(`[Driver Dashboard] Driver ID from session: ${driverId}`);
  console.log(`[Driver Dashboard] Subscriptions found with matching driverId: ${allDriverSubscriptions.length}`);

  // Also check for daily driver overrides - subscriptions where driver is assigned via override for today
  const dailyDriverOverrides = await prisma.subscriptionDailyDriver.findMany({
    where: {
      driverId,
      date: today,
    },
    include: {
      PackageSubscription: {
        select: {
          id: true,
          status: true,
          washesRemaining: true,
          startDate: true,
          endDate: true,
          preferredWashDates: true,
          driverId: true,
        },
      },
    },
  });
  console.log(`[Driver Dashboard] Daily driver overrides for today:`, dailyDriverOverrides);
  
  // Get subscription IDs from overrides
  const overrideSubscriptionIds = dailyDriverOverrides.map(d => d.PackageSubscription.id);
  console.log(`[Driver Dashboard] Override subscription IDs:`, overrideSubscriptionIds);

  // Also fetch subscriptions scheduled for today that haven't been started yet
  // Include both: subscriptions assigned directly to driver + subscriptions with daily driver override
  const allSubscriptionIdsToCheck = new Set([
    ...allDriverSubscriptions.map(s => s.id),
    ...overrideSubscriptionIds,
  ]);
  console.log(`[Driver Dashboard] All subscription IDs to check:`, Array.from(allSubscriptionIdsToCheck));

  // Try multiple date formats to handle different storage formats
  const todayDate = new Date();
  const dayOfMonth = todayDate.getDate().toString(); // e.g., "10"
  const monthShort = todayDate.toLocaleString('en-US', { month: 'short' }); // e.g., "Apr"
  const year = todayDate.getFullYear().toString(); // e.g., "2026"
  const month = (todayDate.getMonth() + 1).toString().padStart(2, '0'); // e.g., "04"
  const dayPadded = dayOfMonth.padStart(2, '0'); // e.g., "10"
  
  const dateVariants = [
    today, // ISO format: YYYY-MM-DD (e.g., "2026-04-10")
    `${dayOfMonth} ${monthShort}`, // e.g., "10 Apr"
    `${dayPadded} ${monthShort}`, // e.g., "10 Apr"
    dayOfMonth, // just day number: e.g., "10"
    dayPadded, // padded day number: e.g., "10"
    `${year}-${month}-${dayOfMonth}`, // without padded day: e.g., "2026-04-10"
    `${year}/${month}/${dayPadded}`, // slash format: e.g., "2026/04/10"
    `${dayPadded}/${month}/${year}`, // UK format: e.g., "10/04/2026"
    `${month}/${dayPadded}/${year}`, // US format: e.g., "04/10/2026"
    new Date().toLocaleDateString('en-GB'), // e.g., "10/04/2026"
    new Date().toLocaleDateString('en-US'), // e.g., "4/10/2026"
  ];
  
  console.log(`[Driver Dashboard] Date variants to try:`, dateVariants);

  // Try each date variant
  let scheduledSubscriptions: any[] = [];
  for (const dateVariant of dateVariants) {
    const subs = await prisma.packageSubscription.findMany({
      where: {
        driverId,
        status: 'ACTIVE',
        washesRemaining: { gt: 0 },
        startDate: { lte: now },
        endDate: { gte: now },
        preferredWashDates: { has: dateVariant },
        id: { notIn: Array.from(existingSubscriptionIds) },
      },
      include: {
        MonthlyPackage: true,
        User_PackageSubscription_userIdToUser: true,
      },
    });
    
    if (subs.length > 0) {
      console.log(`[Driver Dashboard] Found ${subs.length} scheduled subscriptions using date variant: ${dateVariant}`);
      scheduledSubscriptions = subs;
      break;
    }
  }

  // If still no subscriptions, try a more flexible approach - check all subscriptions
  // and manually filter by checking if preferredWashDates contains today's date
  if (scheduledSubscriptions.length === 0) {
    console.log(`[Driver Dashboard] Trying flexible date matching...`);
    
    // Query subscriptions that match either: assigned to driver OR have daily override
    const allActiveSubs = await prisma.packageSubscription.findMany({
      where: {
        OR: [
          { driverId }, // Direct assignment
          { id: { in: Array.from(allSubscriptionIdsToCheck) } }, // Via override or previous query
        ],
        status: 'ACTIVE',
        washesRemaining: { gt: 0 },
        startDate: { lte: now },
        endDate: { gte: now },
        id: { notIn: Array.from(existingSubscriptionIds) },
      },
      include: {
        MonthlyPackage: true,
        User_PackageSubscription_userIdToUser: true,
      },
    });
    
    console.log(`[Driver Dashboard] Checking ${allActiveSubs.length} active subscriptions for flexible date match`);
    
    // Filter subscriptions where preferredWashDates contains a date matching today
    scheduledSubscriptions = allActiveSubs.filter(sub => {
      const dates = sub.preferredWashDates || [];
      console.log(`[Driver Dashboard] Checking subscription ${sub.id}, preferredWashDates:`, dates);
      
      return dates.some(dateStr => {
        // Check various matching patterns
        const matches = [
          dateStr === today, // exact ISO match
          dateStr === dayOfMonth, // just day number
          dateStr === dayPadded, // padded day number
          dateStr.includes(today), // contains full date
          dateStr.includes(dayOfMonth) && dateStr.includes(monthShort), // contains day and month
          dateStr.includes(`${year}-${month}`), // contains year-month
          dateStr.includes(`${dayPadded} ${monthShort}`), // specific format
        ];
        const isMatch = matches.some(m => m);
        if (isMatch) {
          console.log(`[Driver Dashboard] Date match found: "${dateStr}" matches today (${today})`);
        }
        return isMatch;
      });
    });
    
    console.log(`[Driver Dashboard] Flexible matching found ${scheduledSubscriptions.length} subscriptions`);
  }

  console.log(`[Driver Dashboard] Found ${scheduledSubscriptions.length} scheduled subscriptions for today`);
  console.log(`[Driver Dashboard] Scheduled subscriptions details:`, scheduledSubscriptions.map(s => ({
    id: s.id,
    driverId: s.driverId,
    status: s.status,
    washesRemaining: s.washesRemaining,
    startDate: s.startDate,
    endDate: s.endDate,
    preferredWashDates: s.preferredWashDates,
  })));

  // If still no subscriptions, try without date filter to see what's available
  if (scheduledSubscriptions.length === 0) {
    const allActiveSubscriptions = await prisma.packageSubscription.findMany({
      where: {
        driverId,
        status: 'ACTIVE',
        washesRemaining: { gt: 0 },
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        MonthlyPackage: true,
        User_PackageSubscription_userIdToUser: true,
      },
    });
    console.log(`[Driver Dashboard] All active subscriptions (no date filter):`, allActiveSubscriptions.map(s => ({
      id: s.id,
      preferredWashDates: s.preferredWashDates,
    })));
  }

  // Transform existing daily tasks
  const formattedExistingTasks = existingDailyTasks.map(task => ({
    id: task.id,
    subscriptionId: task.subscriptionId,
    date: task.date,
    packageName: task.PackageSubscription.MonthlyPackage.name,
    customerName: task.PackageSubscription.User_PackageSubscription_userIdToUser.name || 'Unknown',
    amountCents: task.PackageSubscription.pricePaidCents,
    taskStatus: task.taskStatus,
    carDescription: `${task.PackageSubscription.vehicleMake} ${task.PackageSubscription.vehicleModel} (${task.PackageSubscription.vehicleColor})` || null,
    locationLabel: task.PackageSubscription.locationLabel,
    locationCoordinates: task.PackageSubscription.locationCoordinates,
  }));

  // Transform scheduled subscriptions (these will have ASSIGNED status by default)
  const formattedScheduledTasks = scheduledSubscriptions.map(sub => ({
    id: `scheduled_${sub.id}_${today}`,
    subscriptionId: sub.id,
    date: today,
    packageName: sub.MonthlyPackage.name,
    customerName: sub.User_PackageSubscription_userIdToUser.name || 'Unknown',
    amountCents: sub.pricePaidCents,
    taskStatus: 'ASSIGNED' as const,
    carDescription: `${sub.vehicleMake} ${sub.vehicleModel} (${sub.vehicleColor})` || null,
    locationLabel: sub.locationLabel,
    locationCoordinates: sub.locationCoordinates,
  }));

  // Combine both lists
  const formattedSubscriptionTasks = [...formattedExistingTasks, ...formattedScheduledTasks];

  console.log(`[Driver Dashboard] Response summary:`, {
    assignmentBookingsCount: assignmentBookings.length,
    spotBookingsCount: spotBookings.length,
    cashBookingsCount: cashBookings.length,
    subscriptionTasksCount: formattedSubscriptionTasks.length,
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
      subscriptionTasks: formattedSubscriptionTasks,
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
