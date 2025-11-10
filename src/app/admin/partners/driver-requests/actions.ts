'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { requireAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

async function ensureAdmin() {
  const session = await requireAdminSession();
  const adminId = session.user?.id;
  if (!adminId) {
    throw new Error('Admin session missing user id');
  }
  return adminId;
}

function redirectWithParams(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString();
  redirect(`/admin/partners/driver-requests${search ? `?${search}` : ''}`);
}

export async function approveDriverRequest(requestId: string, _formData?: FormData) {
  const adminId = await ensureAdmin();

  const request = await prisma.partnerDriverRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    redirectWithParams({ error: 'Request not found' });
  }

  if (request.status !== 'PENDING') {
    redirectWithParams({ error: 'Request already processed' });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: request.email } });
  if (existingUser) {
    await prisma.partnerDriverRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Email already exists in the system. Please pick a different email.',
        processedAt: new Date(),
        processedById: adminId,
        rejectionCount: request.rejectionCount + 1,
      },
    });

    revalidatePath('/partner');
    revalidatePath('/admin/partners/driver-requests');
    revalidatePath(`/admin/partners/${request.partnerId}`);
    redirect('/admin/partners/driver-requests?error=Email%20already%20exists');
  }

  try {
    await prisma.$transaction([
      prisma.user.create({
        data: {
          name: request.name,
          email: request.email,
          passwordHash: request.passwordHash,
          role: 'DRIVER',
          partnerId: request.partnerId,
        },
      }),
      prisma.partnerDriverRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          rejectionReason: null,
          processedAt: new Date(),
          processedById: adminId,
        },
      }),
    ]);
  } catch (error) {
    const err = error as PrismaClientKnownRequestError | Error;
    let message = 'Unable to approve driver request.';
    if ((err as PrismaClientKnownRequestError).code === 'P2002') {
      message = 'Email already exists in the system.';
    }
    await prisma.partnerDriverRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectionReason: message,
        processedAt: new Date(),
        processedById: adminId,
        rejectionCount: request.rejectionCount + 1,
      },
    });
    revalidatePath('/partner');
    revalidatePath('/admin/partners/driver-requests');
    revalidatePath(`/admin/partners/${request.partnerId}`);
    redirect(`/admin/partners/driver-requests?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/partner');
  revalidatePath('/admin/partners/driver-requests');
  revalidatePath(`/admin/partners/${request.partnerId}`);
  revalidatePath('/admin/drivers');

  redirectWithParams({ success: 'Driver approved and account created.' });
}

export async function rejectDriverRequest(requestId: string, formData: FormData) {
  const adminId = await ensureAdmin();
  const reason = (formData.get('reason') ?? '').toString().trim();

  if (!reason) {
    redirectWithParams({ error: 'Please provide a rejection reason.' });
  }

  const request = await prisma.partnerDriverRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    redirectWithParams({ error: 'Request not found.' });
  }

  if (request.status !== 'PENDING') {
    redirectWithParams({ error: 'Request already processed.' });
  }

  await prisma.partnerDriverRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
      processedAt: new Date(),
      processedById: adminId,
      labourCardFileBytes: null,
      labourCardFileName: null,
      labourCardFileType: null,
      emiratesIdFrontBytes: null,
      emiratesIdFrontName: null,
      emiratesIdFrontType: null,
      emiratesIdBackBytes: null,
      emiratesIdBackName: null,
      emiratesIdBackType: null,
      rejectionCount: request.rejectionCount + 1,
    },
  });

  revalidatePath('/partner');
  revalidatePath('/admin/partners/driver-requests');
  revalidatePath(`/admin/partners/${request.partnerId}`);
  redirectWithParams({ success: 'Request rejected successfully.' });
}
