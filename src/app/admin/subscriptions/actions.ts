'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

type MonthlyPackage = {
  id: string;
  washesPerMonth: number;
};

type PrismaWithSubscriptions = typeof prisma & {
  monthlyPackage: {
    findUnique: (args: unknown) => Promise<MonthlyPackage | null>;
  };
  packageSubscription: {
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<unknown>;
  };
  subscriptionDailyDriver: {
    deleteMany: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
};

const subscriptionsDb = prisma as PrismaWithSubscriptions;

export async function assignSubscriptionDriver(formData: FormData) {
  await requireAdminSession();

  const subscriptionId = getString(formData, 'subscriptionId');
  const driverIdRaw = formData.get('driverId');
  const driverId = typeof driverIdRaw === 'string' && driverIdRaw.trim() !== '' ? driverIdRaw.trim() : null;

  await subscriptionsDb.packageSubscription.update({
    where: { id: subscriptionId },
    data: driverId
      ? {
          User_PackageSubscription_driverIdToUser: {
            connect: { id: driverId },
          },
        }
      : {
          User_PackageSubscription_driverIdToUser: {
            disconnect: true,
          },
        },
  });

  revalidatePath('/admin/subscriptions');
  revalidatePath(`/admin/subscriptions/${subscriptionId}`);
}

export async function assignSubscriptionDayDriver(formData: FormData) {
  await requireAdminSession();

  const subscriptionId = getString(formData, 'subscriptionId');
  const date = getString(formData, 'date'); // YYYY-MM-DD
  const driverIdRaw = formData.get('driverId');
  const driverId = typeof driverIdRaw === 'string' && driverIdRaw.trim() !== '' ? driverIdRaw.trim() : null;

  // Clear existing override for this subscription + date
  await subscriptionsDb.subscriptionDailyDriver.deleteMany({
    where: { subscriptionId, date },
  });

  // If a driver is selected, create new override
  if (driverId) {
    await subscriptionsDb.subscriptionDailyDriver.create({
      data: {
        subscriptionId,
        date,
        driverId,
      },
    });
  }

  revalidatePath('/admin/subscriptions?tab=today');
  revalidatePath('/admin/subscriptions');
  revalidatePath(`/admin/subscriptions/${subscriptionId}`);
}

export async function updateSubscriptionSchedule(formData: FormData) {
  await requireAdminSession();

  const subscriptionId = getString(formData, 'subscriptionId');
  const scheduleDatesRaw = formData.get('scheduleDates');

  if (typeof scheduleDatesRaw !== 'string' || !scheduleDatesRaw.trim()) {
    throw new Error('Schedule dates are required');
  }

  // Parse comma-separated YYYY-MM-DD dates
  const scheduleDates = scheduleDatesRaw
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  if (scheduleDates.length === 0) {
    throw new Error('At least one schedule date is required');
  }

  // Fetch subscription and package to validate
  const subscription = await subscriptionsDb.packageSubscription.findUnique({
    where: { id: subscriptionId },
    select: {
      packageId: true,
    },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const pkg = await subscriptionsDb.monthlyPackage.findUnique({
    where: { id: subscription.packageId },
  });

  if (!pkg) {
    throw new Error('Package not found');
  }

  // Validate: cannot select more days than washes
  if (scheduleDates.length > pkg.washesPerMonth) {
    throw new Error(
      `You selected ${scheduleDates.length} days, but this package includes only ${pkg.washesPerMonth} washes. Please select up to ${pkg.washesPerMonth} washes.`
    );
  }

  // Update schedule
  await subscriptionsDb.packageSubscription.update({
    where: { id: subscriptionId },
    data: {
      preferredWashDates: scheduleDates,
    },
  });

  revalidatePath('/admin/subscriptions');
  revalidatePath(`/admin/subscriptions/${subscriptionId}`);
}

// Create a manual subscription for WhatsApp purchases
export async function createManualSubscription(formData: FormData) {
  await requireAdminSession();

  const userId = getString(formData, 'userId');
  const packageId = getString(formData, 'packageId');
  const pricePaidCents = parseInt(getString(formData, 'pricePaidCents'), 10);
  const paymentMethod = getString(formData, 'paymentMethod'); // 'CASH' | 'BANK_TRANSFER' | 'WHATSAPP'
  const notes = formData.get('notes') as string | null;
  
  // Optional fields
  const vehicleMake = formData.get('vehicleMake') as string | null;
  const vehicleModel = formData.get('vehicleModel') as string | null;
  const vehicleColor = formData.get('vehicleColor') as string | null;
  const vehicleType = formData.get('vehicleType') as string | null;
  const vehiclePlate = formData.get('vehiclePlate') as string | null;
  const locationLabel = formData.get('locationLabel') as string | null;
  const locationCoordinates = formData.get('locationCoordinates') as string | null;
  
  // Schedule dates (comma-separated)
  const scheduleDatesRaw = formData.get('scheduleDates') as string | null;
  const scheduleDates = scheduleDatesRaw
    ? scheduleDatesRaw.split(',').map((d) => d.trim()).filter((d) => d.length > 0)
    : [];

  // Fetch package details
  const pkg = await subscriptionsDb.monthlyPackage.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    throw new Error('Package not found');
  }

  // Validate schedule dates count
  if (scheduleDates.length > pkg.washesPerMonth) {
    throw new Error(
      `You selected ${scheduleDates.length} days, but this package includes only ${pkg.washesPerMonth} washes.`
    );
  }

  // Calculate start and end dates
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

  // Generate subscription ID
  const subscriptionId = `sub_manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const paymentId = `manual_${paymentMethod.toLowerCase()}_${Date.now()}`;

  // Create the subscription
  const subscription = await subscriptionsDb.packageSubscription.create({
    data: {
      id: subscriptionId,
      userId,
      packageId,
      status: 'ACTIVE',
      startDate,
      endDate,
      washesRemaining: pkg.washesPerMonth,
      washesUsed: 0,
      pricePaidCents,
      paymentId,
      preferredWashDates: scheduleDates,
      vehicleMake: vehicleMake || null,
      vehicleModel: vehicleModel || null,
      vehicleColor: vehicleColor || null,
      vehicleType: vehicleType || null,
      vehiclePlate: vehiclePlate || null,
      locationLabel: locationLabel || null,
      locationCoordinates: locationCoordinates || null,
      autoRenew: false, // Manual subscriptions don't auto-renew
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Create a subscription request record for tracking (marked as completed)
  const requestId = `req_manual_${Date.now()}`;
  await prisma.subscriptionRequest.create({
    data: {
      id: requestId,
      userId,
      packageId,
      status: 'COMPLETED',
      scheduleDates,
      vehicleMake: vehicleMake || null,
      vehicleModel: vehicleModel || null,
      vehicleColor: vehicleColor || null,
      vehicleType: vehicleType || null,
      vehiclePlate: vehiclePlate || null,
      locationLabel: locationLabel || null,
      locationCoordinates: locationCoordinates || null,
      paymentIntentId: paymentId,
      subscriptionId: subscription.id,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  revalidatePath('/admin/subscriptions');
  
  return { success: true, subscriptionId: subscription.id };
}

// Delete a subscription
export async function deleteSubscription(formData: FormData) {
  await requireAdminSession();

  const subscriptionId = getString(formData, 'subscriptionId');

  // Check if subscription exists
  const subscription = await subscriptionsDb.packageSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Delete the subscription (cascade will delete related daily drivers)
  await subscriptionsDb.packageSubscription.delete({
    where: { id: subscriptionId },
  });

  revalidatePath('/admin/subscriptions');
  revalidatePath('/admin/subscriptions/requests');
}

// Update subscription status (cancel, pause, resume)
export async function updateSubscriptionStatus(formData: FormData) {
  await requireAdminSession();

  const subscriptionId = getString(formData, 'subscriptionId');
  const status = getString(formData, 'status'); // 'ACTIVE', 'CANCELLED', 'PAUSED', 'EXPIRED'
  const reason = formData.get('reason') as string | null;

  const validStatuses = ['ACTIVE', 'CANCELLED', 'PAUSED', 'EXPIRED'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  // Check if subscription exists
  const subscription = await subscriptionsDb.packageSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Update subscription
  const updateData: any = { status };
  
  if (status === 'CANCELLED') {
    updateData.cancelledAt = new Date();
    updateData.cancellationReason = reason || 'Cancelled by admin';
  }

  await subscriptionsDb.packageSubscription.update({
    where: { id: subscriptionId },
    data: updateData,
  });

  revalidatePath('/admin/subscriptions');
  revalidatePath(`/admin/subscriptions/${subscriptionId}`);
}

// Update subscription details
export async function updateSubscriptionDetails(formData: FormData) {
  await requireAdminSession();

  const subscriptionId = getString(formData, 'subscriptionId');
  
  // Optional fields
  const vehicleMake = formData.get('vehicleMake') as string | null;
  const vehicleModel = formData.get('vehicleModel') as string | null;
  const vehicleColor = formData.get('vehicleColor') as string | null;
  const vehicleType = formData.get('vehicleType') as string | null;
  const vehiclePlate = formData.get('vehiclePlate') as string | null;
  const locationLabel = formData.get('locationLabel') as string | null;
  const locationCoordinates = formData.get('locationCoordinates') as string | null;
  const autoRenew = formData.get('autoRenew') === 'true';
  
  // New fields
  const packageId = formData.get('packageId') as string | null;
  const pricePaidCentsRaw = formData.get('pricePaidCents') as string | null;
  const pricePaidCents = pricePaidCentsRaw ? Math.round(parseFloat(pricePaidCentsRaw) * 100) : null;
  const washesRemainingRaw = formData.get('washesRemaining') as string | null;
  const washesRemaining = washesRemainingRaw ? parseInt(washesRemainingRaw, 10) : null;
  const washesUsedRaw = formData.get('washesUsed') as string | null;
  const washesUsed = washesUsedRaw ? parseInt(washesUsedRaw, 10) : null;
  const startDateRaw = formData.get('startDate') as string | null;
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDateRaw = formData.get('endDate') as string | null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;

  // Check if subscription exists
  const subscription = await subscriptionsDb.packageSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Build update data
  const updateData: any = {
    vehicleMake: vehicleMake || subscription.vehicleMake,
    vehicleModel: vehicleModel || subscription.vehicleModel,
    vehicleColor: vehicleColor || subscription.vehicleColor,
    vehicleType: vehicleType || subscription.vehicleType,
    vehiclePlate: vehiclePlate || subscription.vehiclePlate,
    locationLabel: locationLabel || subscription.locationLabel,
    locationCoordinates: locationCoordinates || subscription.locationCoordinates,
    autoRenew,
  };
  
  if (packageId) updateData.packageId = packageId;
  if (pricePaidCents !== null) updateData.pricePaidCents = pricePaidCents;
  if (washesRemaining !== null) updateData.washesRemaining = washesRemaining;
  if (washesUsed !== null) updateData.washesUsed = washesUsed;
  if (startDate) updateData.startDate = startDate;
  if (endDate) updateData.endDate = endDate;

  // Update subscription
  await subscriptionsDb.packageSubscription.update({
    where: { id: subscriptionId },
    data: updateData,
  });

  revalidatePath('/admin/subscriptions');
  revalidatePath(`/admin/subscriptions/${subscriptionId}`);
}
