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

type PrismaWithRequests = typeof prisma & {
  subscriptionRequest: {
    findUnique: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
  };
};

const requestsDb = prisma as PrismaWithRequests;

export async function approveSubscriptionRequest(formData: FormData) {
  await requireAdminSession();

  const requestId = getString(formData, 'requestId');

  const request = await requestsDb.subscriptionRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error('Request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error('Request is not pending');
  }

  await requestsDb.subscriptionRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  });

  revalidatePath('/admin/subscriptions/requests');
}

export async function rejectSubscriptionRequest(formData: FormData) {
  await requireAdminSession();

  const requestId = getString(formData, 'requestId');
  const rejectionReason = getString(formData, 'rejectionReason');

  const request = await requestsDb.subscriptionRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error('Request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error('Request is not pending');
  }

  await requestsDb.subscriptionRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      rejectionReason,
      rejectedAt: new Date(),
    },
  });

  revalidatePath('/admin/subscriptions/requests');
}
