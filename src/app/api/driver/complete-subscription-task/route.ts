import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { publishLiveUpdate } from "@/lib/liveUpdates";

const schema = z.object({
  subscriptionId: z.string(),
  date: z.string(),
});

export async function POST(req: Request) {
  const session = await getMobileUserFromRequest(req);
  if (!session || session.role !== "DRIVER") {
    return errorResponse("Unauthorized", 401);
  }

  const driverId = session.sub;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  
  if (!parsed.success) {
    return errorResponse("Missing subscriptionId or date", 400);
  }

  const { subscriptionId, date } = parsed.data;

  // Verify subscription ownership and check if it's active for this date
  const now = new Date();
  const subscription = await prisma.packageSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      SubscriptionDailyDriver: {
        where: { date },
        select: { driverId: true },
      },
    },
  });

  if (!subscription) {
    return errorResponse("Subscription not found", 404);
  }

  // Check subscription status and validity
  if (
    subscription.status !== 'ACTIVE' ||
    subscription.washesRemaining <= 0 ||
    !subscription.preferredWashDates.includes(date) ||
    subscription.startDate > now ||
    subscription.endDate < now
  ) {
    return errorResponse("Subscription not active for this date", 400);
  }

  // Check driver assignment
  const override = subscription.SubscriptionDailyDriver[0];
  const effectiveDriverId = override?.driverId ?? subscription.driverId;

  if (!effectiveDriverId || effectiveDriverId !== driverId) {
    return errorResponse("Subscription not assigned to this driver for this date", 403);
  }

  // Check if task already exists and is in progress
  const existing = await prisma.subscriptionDailyDriver.findFirst({
    where: { subscriptionId, date },
  });

  if (existing && existing.taskStatus === 'COMPLETED') {
    return errorResponse("Task already completed", 400);
  }

  // Use transaction to update both daily driver and subscription
  await prisma.$transaction(async (tx) => {
    if (existing) {
      if (existing.driverId !== driverId) {
        throw new Error("Subscription wash assigned to a different driver");
      }

      // Update existing task
      await tx.subscriptionDailyDriver.update({
        where: { id: existing.id },
        data: {
          taskStatus: 'COMPLETED',
          taskCompletedAt: new Date(),
        },
      });
    } else {
      // Create new task as completed
      await tx.subscriptionDailyDriver.create({
        data: {
          id: `subdaily_${subscriptionId}_${date}_${Date.now()}`,
          subscriptionId,
          date,
          driverId,
          taskStatus: 'COMPLETED',
          taskCompletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Update subscription wash counts
    await tx.packageSubscription.update({
      where: { id: subscriptionId },
      data: {
        washesRemaining: { decrement: 1 },
        washesUsed: { increment: 1 },
      },
    });
  });

  // Broadcast update
  publishLiveUpdate(
    { type: 'bookings.updated' as const },
    undefined
  );

  return jsonResponse({ success: true, message: "Subscription wash completed successfully" });
}

export function OPTIONS() {
  return noContentResponse();
}
