'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';
import { sendToUser } from '@/lib/notifications-v2';

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
    select: {
      id: true,
      status: true,
      userId: true,
    },
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

  if (request.userId) {
    // Notify CUSTOMER about approval
    void sendToUser(request.userId, 'CUSTOMER', {
      title: 'Subscription Approved',
      body: 'Great news! Your subscription request has been approved. You can now proceed to payment.',
      category: 'CUSTOMER',
      entityType: 'subscription_request',
      entityId: requestId,
    });
  }

  revalidatePath('/admin/subscriptions/requests');
}

export async function rejectSubscriptionRequest(formData: FormData) {
  try {
    await requireAdminSession();
  } catch (error) {
    console.error('[SubscriptionRequest] Admin session failed:', error);
    throw error;
  }

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

  if (request.userId) {
    // Notify CUSTOMER about rejection
    void sendToUser(request.userId, 'CUSTOMER', {
      title: 'Subscription Request',
      body: 'Unfortunately, your subscription request was not approved. You can apply again or contact support.',
      category: 'CUSTOMER',
      entityType: 'subscription_request',
      entityId: requestId,
    });
  }

  revalidatePath('/admin/subscriptions/requests');
}
