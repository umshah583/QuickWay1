'use server';

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
          driver: {
            connect: { id: driverId },
          },
        }
      : {
          driver: {
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
      `You selected ${scheduleDates.length} days, but this package includes only ${pkg.washesPerMonth} washes. Please select up to ${pkg.washesPerMonth} days.`
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
