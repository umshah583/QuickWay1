'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

function parsePriceCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid price');
  }
  return Math.round(parsed * 100);
}

function parseOptionalDiscount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.min(100, parsed));
}

export async function upsertServiceAreaPrice(formData: FormData) {
  await requireAdminSession();

  const areaId = formData.get('areaId');
  const serviceId = formData.get('serviceId');

  if (typeof areaId !== 'string' || !areaId) {
    throw new Error('Missing areaId');
  }
  if (typeof serviceId !== 'string' || !serviceId) {
    throw new Error('Missing serviceId');
  }

  const priceCents = parsePriceCents(formData.get('price'));
  const discountPercentage = parseOptionalDiscount(formData.get('discount'));

  if (priceCents === null) {
    await prisma.serviceAreaPrice.deleteMany({ where: { serviceId, areaId } });
    revalidatePath('/admin/zones');
    revalidatePath(`/admin/zones/${areaId}`);
    return;
  }

  await prisma.serviceAreaPrice.upsert({
    where: {
      serviceId_areaId: {
        serviceId,
        areaId,
      },
    },
    create: {
      serviceId,
      areaId,
      priceCents,
      discountPercentage,
      active: true,
    },
    update: {
      priceCents,
      discountPercentage,
      active: true,
    },
  });

  revalidatePath('/admin/zones');
  revalidatePath(`/admin/zones/${areaId}`);
}

export async function deleteServiceAreaPrice(formData: FormData) {
  await requireAdminSession();

  const areaId = formData.get('areaId');
  const serviceId = formData.get('serviceId');

  if (typeof areaId !== 'string' || !areaId) {
    throw new Error('Missing areaId');
  }
  if (typeof serviceId !== 'string' || !serviceId) {
    throw new Error('Missing serviceId');
  }

  await prisma.serviceAreaPrice.deleteMany({
    where: { areaId, serviceId },
  });

  revalidatePath('/admin/zones');
  revalidatePath(`/admin/zones/${areaId}`);
}
