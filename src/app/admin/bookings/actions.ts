'use server';

import { NotificationCategory, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import { sendPushNotificationToUser } from '@/lib/push';
import { recordNotification } from '@/lib/admin-notifications';
import { publishLiveUpdate } from '@/lib/liveUpdates';

const BOOKING_STATUSES = ['ASSIGNED', 'PENDING', 'PAID', 'CANCELLED'] as const;
type BookingStatusValue = typeof BOOKING_STATUSES[number];

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

export async function updateBookingStatus(formData: FormData) {
  await requireAdminSession();

  const bookingId = getString(formData, 'bookingId');
  const status = getString(formData, 'status') as BookingStatusValue;

  if (!BOOKING_STATUSES.includes(status)) {
    throw new Error('Invalid status');
  }

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status },
    select: {
      userId: true,
      service: { select: { name: true } },
    },
  });

  if (booking?.userId) {
    const body =
      status === 'PAID'
        ? `Your ${booking.service?.name ?? 'booking'} is completed.`
        : status === 'CANCELLED'
        ? `Your ${booking.service?.name ?? 'booking'} was cancelled.`
        : `Your ${booking.service?.name ?? 'booking'} status is now ${status}.`;

    void sendPushNotificationToUser(booking.userId, {
      title: 'Booking status updated',
      body,
      url: '/account',
    });
  }

  void recordNotification({
    title: 'Booking status updated',
    message: `Booking updated to ${status} for ${booking?.service?.name ?? 'a service'}.`,
    category: status === 'PAID' ? NotificationCategory.PAYMENT : NotificationCategory.ORDER,
    entityType: 'BOOKING',
    entityId: bookingId,
  });

  if (booking?.userId) {
    publishLiveUpdate({ type: 'bookings.updated', userId: booking.userId });
  }
  publishLiveUpdate({ type: 'bookings.updated' });
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/bookings/completed');
}

export async function deleteBooking(formData: FormData) {
  await requireAdminSession();

  const bookingId = getString(formData, 'bookingId');

  const booking = await prisma.booking.delete({
    where: { id: bookingId },
    select: {
      userId: true,
      service: { select: { name: true } },
    },
  });

  if (booking?.userId) {
    void sendPushNotificationToUser(booking.userId, {
      title: 'Booking removed',
      body: `${booking.service?.name ?? 'Your booking'} was removed by the admin.`,
      url: '/account',
    });
    publishLiveUpdate({ type: 'bookings.updated', userId: booking.userId });
  }

  publishLiveUpdate({ type: 'bookings.updated' });
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/bookings/completed');
}

export async function updateBooking(formData: FormData) {
  await requireAdminSession();

  const bookingId = getString(formData, 'bookingId');
  const serviceId = getString(formData, 'serviceId');
  const startAtInput = getString(formData, 'startAt');
  const status = getString(formData, 'status').toUpperCase() as BookingStatusValue;
  const driverIdRaw = formData.get('driverId');
  const cashCollected = formData.get('cashCollected') === 'on';
  const cashAmountRaw = formData.get('cashAmount');
  const driverNotesRaw = formData.get('driverNotes');

  if (!BOOKING_STATUSES.includes(status)) {
    throw new Error('Invalid status');
  }

  const existingBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      userId: true,
      status: true,
      cashCollected: true,
      cashAmountCents: true,
      service: { select: { name: true } },
    },
  });

  if (!existingBooking) {
    throw new Error('Booking not found');
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error('Service not found');
  }

  const startAt = new Date(startAtInput);
  if (isNaN(startAt.getTime())) {
    throw new Error('Invalid start date');
  }

  const endAt = new Date(startAt.getTime() + service.durationMin * 60000);

  let cashAmountCents: number | null = null;
  if (typeof cashAmountRaw === 'string' && cashAmountRaw.trim() !== '') {
    const parsed = Math.round(parseFloat(cashAmountRaw) * 100);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error('Invalid cash amount');
    }
    cashAmountCents = parsed;
  }

  const driverId = typeof driverIdRaw === 'string' && driverIdRaw.trim() !== '' ? driverIdRaw : null;
  const driverNotes = typeof driverNotesRaw === 'string' && driverNotesRaw.trim() !== '' ? driverNotesRaw.trim() : null;

  const nextCashAmountCents = cashAmountCents ?? (cashCollected ? 0 : null);

  const shouldClearCash = status === 'PAID';

  // Snapshot partner commission rate when driver is assigned OR partner is already set
  let partnerCommissionPercentage: number | null = null;
  let partnerIdToConnect: string | null = null;
  
  // Get default commission setting (we'll need this in both cases)
  const defaultCommissionSetting = await prisma.adminSetting.findUnique({
    where: { key: 'DEFAULT_PARTNER_COMMISSION_PERCENTAGE' },
    select: { value: true },
  });
  const defaultCommission = defaultCommissionSetting?.value 
    ? parseFloat(defaultCommissionSetting.value) 
    : 100;
  
  if (driverId) {
    // Driver is being assigned - get partner from driver
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { 
        partnerId: true,
        partner: {
          select: { commissionPercentage: true }
        }
      },
    });
    
    if (driver?.partnerId) {
      partnerIdToConnect = driver.partnerId;
      
      // If partner commission is 0 or null, use default commission
      const individualCommission = driver.partner?.commissionPercentage;
      partnerCommissionPercentage = 
        (individualCommission && individualCommission > 0) 
          ? individualCommission 
          : defaultCommission;
          
      console.log(`[Booking via Driver] Partner ${partnerIdToConnect} - Individual: ${individualCommission}, Default: ${defaultCommission}, Snapshotting: ${partnerCommissionPercentage}%`);
    }
  } else {
    // No driver being assigned - check if booking already has a partner
    const currentBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        partnerId: true,
        partnerCommissionPercentage: true,
        partner: {
          select: { commissionPercentage: true }
        }
      },
    });
    
    if (currentBooking?.partnerId && currentBooking.partnerCommissionPercentage === null) {
      // Booking has a partner but no commission snapshot - create snapshot now!
      partnerIdToConnect = currentBooking.partnerId;
      
      const individualCommission = currentBooking.partner?.commissionPercentage;
      partnerCommissionPercentage = 
        (individualCommission && individualCommission > 0) 
          ? individualCommission 
          : defaultCommission;
          
      console.log(`[Booking Direct Partner] Partner ${partnerIdToConnect} - Individual: ${individualCommission}, Default: ${defaultCommission}, Snapshotting: ${partnerCommissionPercentage}%`);
    }
  }

  const updateData: Prisma.BookingUpdateInput = {
    service: {
      connect: { id: serviceId },
    },
    startAt,
    endAt,
    cashCollected: shouldClearCash ? false : cashCollected,
    cashSettled: shouldClearCash ? true : undefined,
    cashAmountCents: shouldClearCash ? null : nextCashAmountCents,
    driverNotes,
    driver: driverId ? { connect: { id: driverId } } : { disconnect: true },
    taskStatus: driverId ? 'ASSIGNED' : undefined,
    partner: partnerIdToConnect ? { connect: { id: partnerIdToConnect } } : { disconnect: true },
    partnerCommissionPercentage, // Snapshot the commission rate at time of assignment
  };

  const nextStatus: BookingStatusValue = driverId ? (status === 'PAID' ? 'PAID' : 'ASSIGNED') : status;

  console.log(`[Booking Update] Data to save:`, {
    bookingId,
    driverId,
    partnerIdToConnect,
    partnerCommissionPercentage,
    hasPartner: !!partnerIdToConnect,
    commissionToSnapshot: partnerCommissionPercentage,
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...updateData,
      status: nextStatus,
    },
  });

  // Verify the update worked
  const updatedBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      driverId: true,
      taskStatus: true,
      status: true,
      driver: { select: { id: true, name: true, email: true } }
    }
  });

  console.log(`[Booking Update] Updated booking result:`, {
    id: updatedBooking?.id,
    driverId: updatedBooking?.driverId,
    taskStatus: updatedBooking?.taskStatus,
    status: updatedBooking?.status,
    driverName: updatedBooking?.driver?.name,
    driverEmail: updatedBooking?.driver?.email,
  });

  revalidatePath('/admin/bookings');
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/bookings/completed');
  revalidatePath(`/admin/bookings/${bookingId}`);
  const notifications: Promise<void>[] = [];
  const userId = existingBooking.userId;
  const serviceName = service.name;

  const statusChanged = existingBooking.status !== nextStatus;
  if (statusChanged) {
    const body =
      nextStatus === 'PAID'
        ? `Your ${serviceName} is complete.`
        : nextStatus === 'CANCELLED'
        ? `Your ${serviceName} was cancelled.`
        : `Your ${serviceName} status is now ${nextStatus}.`;

    notifications.push(
      sendPushNotificationToUser(userId, {
        title: 'Booking status updated',
        body,
        url: '/account',
      }),
    );

    void recordNotification({
      title: 'Booking status updated',
      message: `${serviceName} moved to ${nextStatus}.`,
      category: nextStatus === 'PAID' ? NotificationCategory.PAYMENT : NotificationCategory.ORDER,
      entityType: 'BOOKING',
      entityId: bookingId,
    });
  }

  const cashWasCollected = existingBooking.cashCollected ?? false;
  const previousAmount = existingBooking.cashAmountCents ?? 0;
  const nextAmount = nextCashAmountCents ?? previousAmount;
  if (cashCollected && (!cashWasCollected || previousAmount !== nextAmount)) {
    notifications.push(
      sendPushNotificationToUser(userId, {
        title: 'Cash payment received',
        body: `Payment for ${serviceName} has been recorded as collected.`,
        url: '/account',
      }),
    );
  }

  if (notifications.length) {
    await Promise.allSettled(notifications);
  }

  // Send live update to customer
  publishLiveUpdate({ type: 'bookings.updated', userId });
  
  // Send live update to driver if one was assigned
  if (driverId) {
    publishLiveUpdate({ type: 'bookings.updated' }, { userIds: [driverId] });
  }
  
  publishLiveUpdate({ type: 'bookings.updated' });
  redirect('/admin/bookings');
}
