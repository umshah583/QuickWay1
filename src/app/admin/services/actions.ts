'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';
import { publishLiveUpdate } from '@/lib/liveUpdates';

function getString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`Missing field: ${key}`);
  }
  return raw.trim();
}

function getOptionalString(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

function parsePositiveInt(value: string, key: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${key}`);
  }
  return parsed;
}

function parsePriceCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid price');
  }
  return Math.round(parsed * 100);
}

function parseOptionalDiscount(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const bounded = Math.min(Math.max(parsed, 0), 100);
  return bounded;
}

function parseCarTypes(formData: FormData): string[] {
  const rawValues = formData.getAll('carTypes');
  const values: string[] = [];
  for (const raw of rawValues) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    values.push(trimmed);
  }

  // Keep unique values only
  return Array.from(new Set(values));
}

export async function createService(formData: FormData) {
  await requireAdminSession();

  const name = getString(formData, 'name');
  const description = getOptionalString(formData, 'description');
  const durationMin = parsePositiveInt(getString(formData, 'durationMin'), 'durationMin');
  const priceCents = parsePriceCents(getString(formData, 'price'));
  const active = formData.get('active') === 'on';
  const discountPercentage = parseOptionalDiscount(getOptionalString(formData, 'discountPercentage'));
  const imageUrl = getOptionalString(formData, 'imageUrl');
  const carTypes = parseCarTypes(formData);
  const serviceTypeId = getOptionalString(formData, 'serviceTypeId');
  const attributeValuesJson = getOptionalString(formData, 'attributeValues');
  const attributeValues = attributeValuesJson ? JSON.parse(attributeValuesJson) : null;

  await prisma.service.create({
    data: { name, description, durationMin, priceCents, active, discountPercentage, imageUrl, carTypes, serviceTypeId, attributeValues },
  });

  publishLiveUpdate({ type: 'services.changed' });
  revalidatePath('/admin/services');
  redirect('/admin/services');
}

export async function updateService(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, 'id');
  const name = getString(formData, 'name');
  const description = getOptionalString(formData, 'description');
  const durationMin = parsePositiveInt(getString(formData, 'durationMin'), 'durationMin');
  const priceCents = parsePriceCents(getString(formData, 'price'));
  const active = formData.get('active') === 'on';
  const discountPercentage = parseOptionalDiscount(getOptionalString(formData, 'discountPercentage'));
  const imageUrl = getOptionalString(formData, 'imageUrl');
  const carTypes = parseCarTypes(formData);
  const serviceTypeId = getOptionalString(formData, 'serviceTypeId');
  const attributeValuesJson = getOptionalString(formData, 'attributeValues');
  const attributeValues = attributeValuesJson ? JSON.parse(attributeValuesJson) : null;

  await prisma.service.update({
    where: { id },
    data: { name, description, durationMin, priceCents, active, discountPercentage, imageUrl, carTypes, serviceTypeId, attributeValues },
  });

  publishLiveUpdate({ type: 'services.changed' });
  revalidatePath('/admin/services');
  revalidatePath(`/admin/services/${id}`);
  redirect('/admin/services');
}

export async function toggleServiceActive(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, 'id');
  const current = formData.get('active') === 'true';

  await prisma.service.update({
    where: { id },
    data: { active: !current },
  });

  publishLiveUpdate({ type: 'services.changed' });
  revalidatePath('/admin/services');
  revalidatePath(`/admin/services/${id}`);
}

export async function deleteService(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, 'id');
  const redirectTo = getOptionalString(formData, 'redirectTo');

  await prisma.service.delete({ where: { id } });

  publishLiveUpdate({ type: 'services.changed' });
  revalidatePath('/admin/services');
  revalidatePath(`/admin/services/${id}`);
  if (redirectTo) {
    redirect(redirectTo);
  }
}
