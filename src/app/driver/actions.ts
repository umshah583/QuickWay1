'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireDriverSession } from '@/lib/driver-auth';
import { sendPushNotificationToUser } from '@/lib/push';

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

  revalidatePath('/driver');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/account');
}

export async function completeTask(formData: FormData) {
  const session = await requireDriverSession();
  const driverId = (session.user as { id: string }).id;
  const bookingId = getString(formData, 'bookingId');

  await assertBookingOwnership(bookingId, driverId);

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      taskStatus: 'COMPLETED',
      status: 'PAID',
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
    select: { service: { select: { priceCents: true } } },
  });

  if (!booking?.service?.priceCents) {
    throw new Error('Unable to determine booking amount');
  }

  const driverNotes = typeof notesRaw === 'string' && notesRaw.trim() !== '' ? notesRaw.trim() : null;

  const bookingUpdate = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      cashCollected: collected,
      cashAmountCents: collected ? booking.service.priceCents : null,
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

  revalidatePath('/driver');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
}
