/* eslint-disable @typescript-eslint/no-explicit-any */

'use server';

import { NotificationCategory } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireDriverSession } from '@/lib/driver-auth';
import { sendPushNotificationToUser } from '@/lib/push';
import { recordNotification } from '@/lib/admin-notifications';
import { publishLiveUpdate } from '@/lib/liveUpdates';

type PrismaWithSubscriptions = typeof prisma & {
  packageSubscription: {
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
  subscriptionDailyDriver: {
    findFirst: (args: unknown) => Promise<any | null>;
    update: (args: unknown) => Promise<any>;
    create: (args: unknown) => Promise<any>;
  };
};

const prismaWithSubs = prisma as PrismaWithSubscriptions;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

async function assertBookingOwnership(bookingId: string, driverId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, driverId: true },
  });

  if (!booking || booking.driverId !== driverId) {
    throw new Error('Booking not assigned to this driver');
  }
}

async function assertSubscriptionOwnership(subscriptionId: string, date: string, driverId: string) {
  const now = new Date();

  const subscription = await prismaWithSubs.packageSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      dailyDrivers: {
        where: { date },
        select: { driverId: true },
      },
    },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (
    subscription.status !== 'ACTIVE' ||
    subscription.washesRemaining <= 0 ||
    !subscription.preferredWashDates.includes(date) ||
    subscription.startDate > now ||
    subscription.endDate < now
  ) {
    throw new Error('Subscription not active for this date');
  }

  const override = subscription.dailyDrivers[0];
  const effectiveDriverId = override?.driverId ?? subscription.driverId;

  if (!effectiveDriverId || effectiveDriverId !== driverId) {
    throw new Error('Subscription not assigned to this driver for this date');
  }
}

export async function startTask(formData: FormData) {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const bookingId = getString(formData, 'bookingId');

  await assertBookingOwnership(bookingId, driverId);

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      taskStatus: 'IN_PROGRESS',
      status: 'ASSIGNED',
      taskStartedAt: new Date(),
    },
    select: {
      userId: true,
      startAt: true,
      service: { select: { name: true } },
    },
  });

  if (booking?.userId) {
    void sendPushNotificationToUser(booking.userId, {
      title: 'Booking in progress',
      body: `Your ${booking.service?.name ?? 'service'} has started.`,
      url: '/account',
    });
  }

  void recordNotification({
    title: 'Driver started a task',
    message: `Driver began ${booking?.service?.name ?? 'a service'} scheduled for ${booking?.startAt?.toLocaleString() ?? ''}.`,
    category: NotificationCategory.DRIVER,
    entityType: 'BOOKING',
    entityId: bookingId,
  });

  if (booking?.userId) {
    publishLiveUpdate({ type: 'bookings.updated', bookingId, userId: booking.userId });
  }
  publishLiveUpdate({ type: 'bookings.updated', bookingId });
  revalidatePath('/driver');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/account');
}

export async function completeSubscriptionTask(formData: FormData) {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const subscriptionId = getString(formData, 'subscriptionId');
  const date = getString(formData, 'date');

  await assertSubscriptionOwnership(subscriptionId, date, driverId);

  await prismaWithSubs.$transaction(async (tx) => {
    const daily = await tx.subscriptionDailyDriver.findFirst({
      where: { subscriptionId, date },
    });

    if (daily && daily.taskStatus === 'COMPLETED') {
      return;
    }

    const subscription = await tx.packageSubscription.findUnique({
      where: { id: subscriptionId },
      select: { washesRemaining: true },
    });

    if (!subscription || subscription.washesRemaining <= 0) {
      throw new Error('No remaining washes for this subscription');
    }

    if (daily) {
      if (daily.driverId !== driverId) {
        throw new Error('Subscription wash assigned to a different driver');
      }

      await tx.subscriptionDailyDriver.update({
        where: { id: daily.id },
        data: {
          taskStatus: 'COMPLETED',
          taskCompletedAt: new Date(),
        },
      });
    } else {
      await tx.subscriptionDailyDriver.create({
        data: {
          subscriptionId,
          date,
          driverId,
          taskStatus: 'COMPLETED',
          taskCompletedAt: new Date(),
        },
      });
    }

    await tx.packageSubscription.update({
      where: { id: subscriptionId },
      data: {
        washesRemaining: { decrement: 1 },
        washesUsed: { increment: 1 },
      },
    });
  });

  revalidatePath('/driver');
  revalidatePath('/admin/subscriptions');
}

export async function startSubscriptionTask(formData: FormData) {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const subscriptionId = getString(formData, 'subscriptionId');
  const date = getString(formData, 'date');

  await assertSubscriptionOwnership(subscriptionId, date, driverId);

  const existing = await prismaWithSubs.subscriptionDailyDriver.findFirst({
    where: { subscriptionId, date },
  });

  if (existing) {
    if (existing.driverId !== driverId) {
      throw new Error('Subscription wash assigned to a different driver');
    }

    await prismaWithSubs.subscriptionDailyDriver.update({
      where: { id: existing.id },
      data: {
        taskStatus: 'IN_PROGRESS',
        taskStartedAt: new Date(),
      },
    });
  } else {
    await prismaWithSubs.subscriptionDailyDriver.create({
      data: {
        subscriptionId,
        date,
        driverId,
        taskStatus: 'IN_PROGRESS',
        taskStartedAt: new Date(),
      },
    });
  }

  revalidatePath('/driver');
  revalidatePath('/admin/subscriptions');
}

export async function completeTask(formData: FormData) {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const bookingId = getString(formData, 'bookingId');

  await assertBookingOwnership(bookingId, driverId);

  const bookingCheck = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      payment: { select: { status: true } },
      cashCollected: true,
    },
  });

  if (!bookingCheck) {
    throw new Error("Booking not found");
  }

  if ((!bookingCheck.payment || bookingCheck.payment.status === "REQUIRES_PAYMENT") && !bookingCheck.cashCollected) {
    throw new Error("Cannot complete task until cash is collected");
  }

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      taskStatus: 'COMPLETED',
      status: 'PAID',
      taskCompletedAt: new Date(),
    },
    select: {
      userId: true,
      endAt: true,
      service: { select: { name: true } },
    },
  });

  if (booking?.userId) {
    void sendPushNotificationToUser(booking.userId, {
      title: 'Booking completed',
      body: `Your ${booking.service?.name ?? 'service'} is complete. Thank you!`,
      url: '/account',
    });
  }

  void recordNotification({
    title: 'Driver completed a task',
    message: `Driver marked ${booking?.service?.name ?? 'a service'} as complete.`,
    category: NotificationCategory.DRIVER,
    entityType: 'BOOKING',
    entityId: bookingId,
  });

  if (booking?.userId) {
    publishLiveUpdate({ type: 'bookings.updated', bookingId, userId: booking.userId });
  }
  publishLiveUpdate({ type: 'bookings.updated', bookingId });
  revalidatePath('/driver');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/account');
}

export async function submitCashDetails(formData: FormData) {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const bookingId = getString(formData, 'bookingId');

  await assertBookingOwnership(bookingId, driverId);

  const collected = formData.get('cashCollected') === 'on';
  const notesRaw = formData.get('driverNotes');

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      cashAmountCents: true,
      service: { select: { priceCents: true } },
    },
  });

  const baseAmountCents =
    booking?.cashAmountCents && booking.cashAmountCents > 0
      ? booking.cashAmountCents
      : booking?.service?.priceCents ?? null;

  if (!baseAmountCents) {
    throw new Error('Unable to determine booking amount');
  }

  const driverNotes = typeof notesRaw === 'string' && notesRaw.trim() !== '' ? notesRaw.trim() : null;

  const bookingUpdate = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      cashCollected: collected,
      cashAmountCents: collected ? baseAmountCents : null,
      cashSettled: false,
      driverNotes,
      status: collected ? 'PAID' : undefined,
    },
    select: {
      userId: true,
      service: { select: { name: true } },
    },
  });

  if (collected && bookingUpdate?.userId) {
    void sendPushNotificationToUser(bookingUpdate.userId, {
      title: 'Cash payment received',
      body: `Payment for ${bookingUpdate.service?.name ?? 'your booking'} has been marked as collected.`,
      url: '/account',
    });
  }

  if (collected) {
    void recordNotification({
      title: 'Cash collection submitted',
      message: `Driver recorded cash for ${bookingUpdate?.service?.name ?? 'a booking'}.`,
      category: NotificationCategory.PAYMENT,
      entityType: 'BOOKING',
      entityId: bookingId,
    });
  }

  if (bookingUpdate?.userId) {
    publishLiveUpdate({ type: 'bookings.updated', bookingId, userId: bookingUpdate.userId });
  }
  publishLiveUpdate({ type: 'bookings.updated', bookingId });
  revalidatePath('/driver');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
}
