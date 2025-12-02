'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { requireAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { PARTNER_SERVICE_CAR_TYPES } from '@/app/partner/services/carTypes';

async function ensureAdmin() {
  const session = await requireAdminSession();
  const adminId = session.user?.id;
  if (!adminId) {
    throw new Error('Admin session missing user id');
  }
  return adminId;
}

function redirectWithParams(params: Record<string, string>): never {
  const search = new URLSearchParams(params).toString();
  redirect(`/admin/partners/driver-requests${search ? `?${search}` : ''}`);
}

function parseServiceForm(formData: FormData) {
  const name = (formData.get('name') ?? '').toString().trim();
  const descriptionRaw = (formData.get('description') ?? '').toString().trim();
  const durationRaw = (formData.get('durationMin') ?? '').toString().trim();
  const priceRaw = (formData.get('price') ?? '').toString().trim();
  const carType = (formData.get('carType') ?? '').toString().trim();
  const imageUrlRaw = (formData.get('imageUrl') ?? '').toString().trim();

  if (!name) {
    throw new Error('Service name is required.');
  }
  if (!durationRaw || Number.isNaN(Number.parseInt(durationRaw, 10)) || Number.parseInt(durationRaw, 10) <= 0) {
    throw new Error('Duration must be a positive number of minutes.');
  }
  if (!priceRaw || Number.isNaN(Number.parseFloat(priceRaw)) || Number.parseFloat(priceRaw) <= 0) {
    throw new Error('Price must be greater than 0.');
  }
  if (!PARTNER_SERVICE_CAR_TYPES.includes(carType as typeof PARTNER_SERVICE_CAR_TYPES[number])) {
    throw new Error('Please select a valid car type.');
  }

  const durationMin = Number.parseInt(durationRaw, 10);
  const priceCents = Math.round(Number.parseFloat(priceRaw) * 100);
  const description = descriptionRaw.length ? descriptionRaw : null;
  const imageUrl = imageUrlRaw.length ? imageUrlRaw : null;

  return { name, description, durationMin, priceCents, carType, imageUrl };
}

export async function updateServiceRequest(requestId: string, formData: FormData) {
  await ensureAdmin();

  try {
    const { name, description, durationMin, priceCents, carType, imageUrl } = parseServiceForm(formData);

    const existing = await prisma.partnerServiceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, partnerId: true },
    });

    if (!existing) {
      redirectWithParams({ error: 'Service request not found.' });
    }

    await prisma.partnerServiceRequest.update({
      where: { id: requestId },
      data: {
        name,
        description,
        durationMin,
        priceCents,
        carType,
        imageUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update service request.';
    redirectWithParams({ error: message });
  }

  revalidatePath('/admin/partners/driver-requests');
  redirectWithParams({ success: 'Service request updated.' });
}

export async function approveServiceRequest(requestId: string): Promise<void> {
  const adminId = await ensureAdmin();

  const request = await prisma.partnerServiceRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    redirectWithParams({ error: 'Service request not found.' });
  }

  if (request.status !== 'PENDING') {
    redirectWithParams({ error: 'Request already processed.' });
  }

  try {
    const initialCarTypes = request.carType ? [request.carType] : [];
    const service = await prisma.service.create({
      data: {
        name: request.name,
        description: request.description,
        durationMin: request.durationMin,
        priceCents: request.priceCents,
        discountPercentage: null,
        active: true,
        imageUrl: request.imageUrl,
        carTypes: initialCarTypes,
      },
    });

    await prisma.partnerServiceRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        rejectionReason: null,
        processedAt: new Date(),
        processedById: adminId,
        serviceId: service.id,
      },
    });
  } catch (error) {
    const err = error as PrismaClientKnownRequestError | Error;
    console.error('Failed to approve service request', err);
    redirectWithParams({ error: 'Unable to approve service request.' });
  }

  revalidatePath('/admin/partners/driver-requests');
  redirectWithParams({ success: 'Service request approved and service created.' });
}

export async function rejectServiceRequest(requestId: string, formData: FormData) {
  const adminId = await ensureAdmin();
  const reason = (formData.get('reason') ?? '').toString().trim();

  if (!reason) {
    redirectWithParams({ error: 'Please provide a rejection reason.' });
  }

  const request = await prisma.partnerServiceRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    redirectWithParams({ error: 'Service request not found.' });
  }

  await prisma.partnerServiceRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
      processedAt: new Date(),
      processedById: adminId,
    },
  });

  revalidatePath('/admin/partners/driver-requests');
  redirectWithParams({ success: 'Service request rejected.' });
}
