'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

export async function updateAreaPolygon(formData: FormData) {
  await requireAdminSession();

  const areaId = formData.get('areaId');
  const polygonJson = formData.get('polygonJson');

  if (typeof areaId !== 'string' || !areaId) {
    throw new Error('Missing areaId');
  }

  if (typeof polygonJson !== 'string') {
    throw new Error('Invalid polygon data');
  }

  // Validate GeoJSON structure
  let parsed: { type?: string; coordinates?: number[][][] };
  try {
    parsed = JSON.parse(polygonJson);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (parsed.type !== 'Polygon' || !Array.isArray(parsed.coordinates)) {
    throw new Error('Invalid GeoJSON Polygon');
  }

  // Update the area with the new polygon
  await prisma.area.update({
    where: { id: areaId },
    data: { polygonJson },
  });

  revalidatePath('/admin/zones');
  revalidatePath(`/admin/zones/${areaId}`);
}
