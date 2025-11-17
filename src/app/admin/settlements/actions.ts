'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

export async function settleDriverCollections(formData: FormData) {
  await requireAdminSession();

  const driverId = getString(formData, 'driverId');

  const unsettledBookings = await prisma.booking.findMany({
    where: {
      driverId,
      cashCollected: true,
      cashSettled: false,
    },
    select: {
      id: true,
      cashAmountCents: true,
      service: { select: { priceCents: true } },
    },
  });

  if (unsettledBookings.length === 0) {
    return;
  }

  await prisma.$transaction([
    prisma.booking.updateMany({
      where: {
        driverId,
        cashCollected: true,
        cashSettled: false,
      },
      data: {
        cashSettled: true,
        status: 'PAID',
      },
    }),
    ...unsettledBookings.map((booking) => {
      const amountCents = booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
      return prisma.payment.upsert({
        where: { bookingId: booking.id },
        update: {
          status: 'PAID',
          provider: 'CASH',
          amountCents,
        },
        create: {
          bookingId: booking.id,
          status: 'PAID',
          provider: 'CASH',
          amountCents,
        },
      });
    }),
  ]);

  revalidatePath('/admin/settlements');
  revalidatePath('/admin/collections');
  revalidatePath('/admin/bookings');
}
