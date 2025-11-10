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

  await prisma.booking.updateMany({
    where: {
      driverId,
      cashCollected: true,
      cashSettled: false,
    },
    data: {
      cashSettled: true,
    },
  });

  revalidatePath('/admin/settlements');
  revalidatePath('/admin/collections');
}
