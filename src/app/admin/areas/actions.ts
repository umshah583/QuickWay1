'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

function getFloat(formData: FormData, key: string): number {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing field: ${key}`);
  }
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${key}`);
  }
  return parsed;
}

function getOptionalFloat(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getOptionalInt(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createArea(formData: FormData) {
  await requireAdminSession();

  const name = getString(formData, 'name');
  const description = formData.get('description') as string | null;
  const minLatitude = getFloat(formData, 'minLatitude');
  const maxLatitude = getFloat(formData, 'maxLatitude');
  const minLongitude = getFloat(formData, 'minLongitude');
  const maxLongitude = getFloat(formData, 'maxLongitude');
  const centerLatitude = getOptionalFloat(formData, 'centerLatitude');
  const centerLongitude = getOptionalFloat(formData, 'centerLongitude');
  const radiusMeters = getOptionalInt(formData, 'radiusMeters');
  const priceMultiplier = getOptionalFloat(formData, 'priceMultiplier') ?? 1.0;
  const sortOrder = parseInt(formData.get('sortOrder') as string || '0', 10) || 0;
  const active = formData.get('active') === 'on';

  // Validate coordinates
  if (minLatitude >= maxLatitude) {
    throw new Error('Min latitude must be less than max latitude');
  }
  if (minLongitude >= maxLongitude) {
    throw new Error('Min longitude must be less than max longitude');
  }

  await prisma.area.create({
    data: {
      name,
      description: description?.trim() || null,
      minLatitude,
      maxLatitude,
      minLongitude,
      maxLongitude,
      centerLatitude,
      centerLongitude,
      radiusMeters,
      priceMultiplier,
      sortOrder,
      active,
    },
  });

  revalidatePath('/admin/areas');
  redirect('/admin/areas');
}

export async function updateArea(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, 'id');
  const name = getString(formData, 'name');
  const description = formData.get('description') as string | null;
  const minLatitude = getFloat(formData, 'minLatitude');
  const maxLatitude = getFloat(formData, 'maxLatitude');
  const minLongitude = getFloat(formData, 'minLongitude');
  const maxLongitude = getFloat(formData, 'maxLongitude');
  const centerLatitude = getOptionalFloat(formData, 'centerLatitude');
  const centerLongitude = getOptionalFloat(formData, 'centerLongitude');
  const radiusMeters = getOptionalInt(formData, 'radiusMeters');
  const priceMultiplier = getOptionalFloat(formData, 'priceMultiplier') ?? 1.0;
  const sortOrder = parseInt(formData.get('sortOrder') as string || '0', 10) || 0;
  const active = formData.get('active') === 'on';

  // Validate coordinates
  if (minLatitude >= maxLatitude) {
    throw new Error('Min latitude must be less than max latitude');
  }
  if (minLongitude >= maxLongitude) {
    throw new Error('Min longitude must be less than max longitude');
  }

  await prisma.area.update({
    where: { id },
    data: {
      name,
      description: description?.trim() || null,
      minLatitude,
      maxLatitude,
      minLongitude,
      maxLongitude,
      centerLatitude,
      centerLongitude,
      radiusMeters,
      priceMultiplier,
      sortOrder,
      active,
    },
  });

  revalidatePath('/admin/areas');
  redirect('/admin/areas');
}

export async function deleteArea(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, 'id');

  // Check if area has bookings
  const bookingsCount = await prisma.booking.count({
    where: { areaId: id },
  });

  if (bookingsCount > 0) {
    throw new Error('Cannot delete area with existing bookings');
  }

  // Delete area (cascade will delete service prices)
  await prisma.area.delete({
    where: { id },
  });

  revalidatePath('/admin/areas');
}
