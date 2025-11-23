import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireDriverSession } from "@/lib/driver-auth";
import { getFeatureFlags, getDriverDutySettings } from "@/lib/admin-settings";
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

type PrismaWithSubscriptions = typeof prisma & {
  packageSubscription: {
    findMany: (args: unknown) => Promise<any[]>;
  };
};

export default async function DriverDashboardPage() {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  
  console.log(`\n🚗 Driver Dashboard Loading for User ID: ${driverId}`);
  console.log(`Session user:`, JSON.stringify(session.user, null, 2));
  
  const featureFlags = await getFeatureFlags();
  const { driverTabOverview, driverTabAssignments, driverTabCash } = featureFlags;
  const dutySettings = await getDriverDutySettings(driverId);

  const prismaWithSubs = prisma as PrismaWithSubscriptions;

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
    (booking: DriverBookingItem) =>
      booking.cashSettled !== true &&
      booking.cashCollected === true &&
      (!booking.payment || booking.payment.status === "REQUIRES_PAYMENT"),
  );

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

  const nowDubai = new Date();
  const todayIso = nowDubai.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });

  let subscriptionTasks: {
    id: string;
    subscriptionId: string;
    date: string;
    packageName: string;
    customerName: string;
    amountCents: number;
    taskStatus: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
    carDescription: string | null;
    locationLabel: string | null;
    locationCoordinates: string | null;
  }[] = [];

  try {
    console.log(`\n========== DRIVER SUBSCRIPTION DEBUG ==========`);
    console.log(`Driver ID: ${driverId}`);
    console.log(`Today ISO: ${todayIso}`);
    console.log(`Now Dubai: ${nowDubai.toISOString()}`);

    // Mirror admin "today's appointments" logic, but only for this driver
    const todaySubscriptions = await prismaWithSubs.packageSubscription.findMany({
      where: {
        status: "ACTIVE",
        washesRemaining: { gt: 0 },
        preferredWashDates: { has: todayIso },
        startDate: { lte: nowDubai },
        endDate: { gte: nowDubai },
      },
      include: {
        user: { select: { name: true } },
        package: { select: { name: true } },
        dailyDrivers: {
          where: { date: todayIso },
          select: {
            date: true,
            driverId: true,
            taskStatus: true,
            taskStartedAt: true,
            taskCompletedAt: true,
          },
        },
      },
    });

    console.log(`\nFound ${todaySubscriptions.length} total active subscriptions for ${todayIso}`);

    todaySubscriptions.forEach((sub: any, idx: number) => {
      console.log(`\nSubscription #${idx + 1}:`);
      console.log(`  ID: ${sub.id}`);
      console.log(`  Package: ${sub.package?.name}`);
      console.log(`  Customer: ${sub.user?.name}`);
      console.log(`  Main driverId: ${sub.driverId || 'NULL'}`);
      console.log(`  Daily overrides: ${sub.dailyDrivers.length}`);
      if (sub.dailyDrivers.length > 0) {
        sub.dailyDrivers.forEach((d: any) => {
          console.log(`    - Date: ${d.date}, DriverId: ${d.driverId}`);
        });
      }
      console.log(`  Preferred dates: ${sub.preferredWashDates.join(', ')}`);
      console.log(`  Status: ${sub.status}, Washes: ${sub.washesRemaining}`);
    });

    const effectiveForDriver = todaySubscriptions.filter((sub: any) => {
      // If there is a daily override for today, that driver wins
      const override = sub.dailyDrivers.find((d: any) => d.date === todayIso);
      const effectiveDriverId = override?.driverId ?? sub.driverId;

      console.log(`\nChecking ${sub.package?.name}:`);
      console.log(`  Effective driver: ${effectiveDriverId}`);
      console.log(`  Logged-in driver: ${driverId}`);
      console.log(`  Match: ${effectiveDriverId === driverId}`);

      return effectiveDriverId === driverId;
    });

    console.log(`\n✅ Total matched subscriptions for this driver: ${effectiveForDriver.length}`);
    console.log(`===============================================\n`);

    subscriptionTasks = effectiveForDriver.map((sub: any) => {
      const daily = Array.isArray(sub.dailyDrivers) && sub.dailyDrivers.length > 0 ? sub.dailyDrivers[0] : null;
      const totalWashes = (sub.washesUsed ?? 0) + (sub.washesRemaining ?? 0);
      const perWashCents = Math.round(sub.pricePaidCents / (totalWashes || 1));
      const taskStatus: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" = daily?.taskStatus ?? "ASSIGNED";

      const carParts = [sub.vehicleMake, sub.vehicleModel, sub.vehicleColor, sub.vehicleType].filter(Boolean);
      const carDescription = carParts.length > 0 ? carParts.join(" ") : null;

      return {
        id: `${sub.id}:${todayIso}`,
        subscriptionId: sub.id,
        date: todayIso,
        packageName: sub.package?.name ?? "Subscription",
        customerName: sub.user?.name ?? "Customer",
        amountCents: perWashCents,
        taskStatus,
        carDescription,
        locationLabel: sub.locationLabel ?? null,
        locationCoordinates: sub.locationCoordinates ?? null,
      };
    });
  } catch (error) {
    console.error("❌ Error loading driver subscription tasks", error);
  }

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
    subscriptionTasks,
  };

  return (
    <>
      <DriverDashboardAutoRefresh />
      <DriverDashboardClient
        data={data}
        featureFlags={{ driverTabOverview, driverTabAssignments, driverTabCash }}
        dutySettings={dutySettings}
      />
    </>
  );
}
