'use server';

import { NotificationCategory, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import { recordNotification } from '@/lib/admin-notifications';
import { publishLiveUpdate } from '@/lib/liveUpdates';
import { emitBusinessEvent } from '@/lib/business-events';
import {
  notifyCustomerBookingUpdate,
  notifyDriverTaskAssigned,
  notifyCustomerDriverAssigned,
  sendToUser,
} from '@/lib/notifications-v2';

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
    const serviceName = booking.service?.name ?? 'booking';
    
    // Send real-time WebSocket update to customer
    publishLiveUpdate(
      { type: 'bookings.updated', bookingId, userId: booking.userId },
      { userIds: [booking.userId] }
    );
    
    if (status === 'PAID') {
      // Service completed - notify CUSTOMER
      void notifyCustomerBookingUpdate(
        booking.userId,
        bookingId,
        'Service Completed',
        `Your ${serviceName} has been completed successfully.`
      );
    } else if (status === 'CANCELLED') {
      // Cancellation - notify CUSTOMER
      void notifyCustomerBookingUpdate(
        booking.userId,
        bookingId,
        'Booking Cancelled',
        `Your ${serviceName} was cancelled.`
      );
    } else {
      // Generic status update - notify CUSTOMER
      void notifyCustomerBookingUpdate(
        booking.userId,
        bookingId,
        'Booking Updated',
        `Your ${serviceName} status is now ${status}.`
      );
    }
  }

  void recordNotification({
    title: 'Booking status updated',
    message: `Booking updated to ${status} for ${booking?.service?.name ?? 'a service'}.`,
    category: status === 'PAID' ? NotificationCategory.PAYMENT : NotificationCategory.ORDER,
    entityType: 'BOOKING',
    entityId: bookingId,
  });

  // Admin dashboard refresh handled by revalidatePath - no broadcast needed
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
    // Send real-time WebSocket update to customer
    publishLiveUpdate(
      { type: 'bookings.updated', bookingId, userId: booking.userId },
      { userIds: [booking.userId] }
    );

    // Notify CUSTOMER about booking deletion
    void notifyCustomerBookingUpdate(
      booking.userId,
      bookingId,
      'Booking Deleted',
      `Your ${booking.service?.name ?? 'booking'} has been removed.`
    );
  }

  // Admin dashboard refresh handled by revalidatePath
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
      driverId: true, // Add driverId to access it later
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
    taskStatus: driverId ? 'ASSIGNED' : undefined, // Use undefined when unassigning (Prisma will set to null)
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
  const userId = existingBooking.userId;
  const serviceName = service.name;

  // Calculate status change
  const statusChanged = existingBooking.status !== nextStatus;

  // Calculate cash collection variables
  const cashWasCollected = existingBooking.cashCollected ?? false;
  const previousAmount = existingBooking.cashAmountCents ?? 0;
  const nextAmount = nextCashAmountCents ?? previousAmount;

  // Emit centralized business event for status changes
  if (statusChanged) {
    if (nextStatus === 'PAID') {
      emitBusinessEvent('booking.completed', {
        bookingId,
        userId,
        driverId: existingBooking.driverId || undefined,
        serviceName
      });
    } else {
      emitBusinessEvent('booking.updated', {
        bookingId,
        userId,
        status: nextStatus,
        serviceName
      });
    }
  }

  // Emit centralized business event for driver assignment
  if (driverId) {
    // Get driver name for customer notification
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { name: true },
    });
    const driverName = driver?.name ?? 'A driver';

    emitBusinessEvent('booking.assigned', {
      bookingId,
      userId,
      driverId,
      serviceName,
      driverName
    });
  } else if (existingBooking.driverId) {
    // Driver is being unassigned - emit unassign event
    emitBusinessEvent('booking.unassigned', {
      bookingId,
      userId,
      previousDriverId: existingBooking.driverId,
      serviceName
    });
  }

  // Handle cash collection notifications
  if (cashCollected && (!cashWasCollected || previousAmount !== nextAmount)) {
    emitBusinessEvent('booking.cash_collected', {
      bookingId,
      userId,
      driverId: existingBooking.driverId || undefined,
      serviceName
    });
  }

  // Admin dashboard refresh is handled by revalidatePath - no broadcast needed
  redirect('/admin/bookings');
}
