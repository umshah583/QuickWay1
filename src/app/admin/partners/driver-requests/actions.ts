'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

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
  throw new Error('Redirect');
}

export async function approveDriverRequest(requestId: string): Promise<void> {
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
    // Generate verification token (expires in 30 minutes)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.$transaction([
      prisma.user.create({
        data: {
          name: request.name,
          email: request.email,
          passwordHash: request.passwordHash,
          role: 'DRIVER',
          partnerId: request.partnerId,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        } as any,
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

    // Send verification email after successful creation
    try {
      await sendVerificationEmail(request.email, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email to approved driver:", emailError);
      // Driver is still created, they can request a new verification email later
    }
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = err as any;
    let message = 'Unable to approve driver request.';
    if (error?.code === 'P2002') {
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
