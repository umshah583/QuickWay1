'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';

const objectIdRegex = /^[a-f\d]{24}$/i;

const partnerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .or(z.literal(''))
    .transform((value) => (value === '' ? null : value)),
});

type PartnerInput = z.infer<typeof partnerSchema>;

export type PartnerFormState = {
  error?: string;
};

function parseFormData(formData: FormData): PartnerInput | { error: string } {
  const raw = Object.fromEntries(formData.entries());
  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input';
    return { error: firstError };
  }
  return parsed.data;
}

async function ensureUniqueEmail(email: string | null, excludeId?: string) {
  if (!email) return null;
  const existing = await prisma.partner.findFirst({
    where: excludeId
      ? {
          email,
          NOT: { id: excludeId },
        }
      : { email },
    select: { id: true },
  });
  if (existing) {
    return 'A partner with this email already exists.';
  }
  return null;
}

async function ensureUserEmailAvailable(email: string) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return 'A user with this email already exists.';
  }
  return null;
}

export async function createPartner(prevState: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  const parsed = parseFormData(formData);
  if ('error' in parsed) {
    return { error: parsed.error };
  }
  const { name, email } = parsed;
  const shouldProvisionLogin = formData.get('createCredentials') === 'on';
  const rawPassword = formData.get('password');

  const uniquenessError = await ensureUniqueEmail(email);
  if (uniquenessError) {
    return { error: uniquenessError };
  }

  if (shouldProvisionLogin) {
    if (!email) {
      return { error: 'Email is required to create partner login credentials.' };
    }
    if (typeof rawPassword !== 'string' || rawPassword.trim().length < 8) {
      return { error: 'Partner password must be at least 8 characters long.' };
    }
    const userEmailError = await ensureUserEmailAvailable(email);
    if (userEmailError) {
      return { error: userEmailError };
    }
  }

  try {
    const partner = await prisma.partner.create({
      data: {
        name,
        email,
      },
    });

    if (shouldProvisionLogin && email) {
      try {
        const passwordHash = bcrypt.hashSync(String(rawPassword), 10);
        const user = await prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: 'PARTNER',
            partnerProfile: {
              connect: { id: partner.id },
            },
          },
        });
        await prisma.partner.update({
          where: { id: partner.id },
          data: { userId: user.id },
        });
      } catch (credentialError) {
        await prisma.partner.delete({ where: { id: partner.id } }).catch(() => {});
        const prismaError = credentialError as PrismaClientKnownRequestError | Error;
        if ((prismaError as PrismaClientKnownRequestError).code === 'P2002') {
          return { error: 'Unable to create partner login because the email is already in use.' };
        }
        console.error('Failed to provision partner login:', prismaError);
        return { error: 'Partner created but login provisioning failed. Please try again.' };
      }
    }
  } catch (err) {
    const error = err as PrismaClientKnownRequestError | Error;
    if ((error as PrismaClientKnownRequestError).code === 'P2002') {
      return { error: 'A partner with this email already exists.' };
    }
    console.error('Failed to create partner:', error);
    return { error: 'Unable to create partner. Please try again.' };
  }

  revalidatePath('/admin/partners');
  redirect('/admin/partners?created=1');
}

export async function updatePartner(
  partnerId: string,
  prevState: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  if (!objectIdRegex.test(partnerId)) {
    return { error: 'Invalid partner identifier.' };
  }

  const partnerRecord = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, userId: true, name: true, email: true },
  });

  if (!partnerRecord) {
    return { error: 'Partner not found.' };
  }

  const parsed = parseFormData(formData);
  if ('error' in parsed) {
    return { error: parsed.error };
  }
  const { name, email } = parsed;
  const shouldProvisionLogin = formData.get('createCredentials') === 'on';
  const rawPassword = formData.get('password');

  const uniquenessError = await ensureUniqueEmail(email, partnerId);
  if (uniquenessError) {
    return { error: uniquenessError };
  }

  if (shouldProvisionLogin) {
    if (partnerRecord.userId) {
      return { error: 'This partner already has login credentials.' };
    }
    if (!email) {
      return { error: 'Email is required to create partner login credentials.' };
    }
    if (typeof rawPassword !== 'string' || rawPassword.trim().length < 8) {
      return { error: 'Partner password must be at least 8 characters long.' };
    }
    const userEmailError = await ensureUserEmailAvailable(email);
    if (userEmailError) {
      return { error: userEmailError };
    }
  }

  try {
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        name,
        email,
      },
    });

    if (partnerRecord.userId && email && email !== partnerRecord.email) {
      await prisma.user.update({
        where: { id: partnerRecord.userId },
        data: { email },
      });
    }

    if (shouldProvisionLogin && email) {
      const passwordHash = bcrypt.hashSync(String(rawPassword), 10);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'PARTNER',
          partnerProfile: {
            connect: { id: partnerId },
          },
        },
      });

      await prisma.partner.update({
        where: { id: partnerId },
        data: { userId: user.id },
      });
    }

    if (!updatedPartner) {
      return { error: 'Unable to update partner. Please try again.' };
    }
  } catch (err) {
    const error = err as PrismaClientKnownRequestError | Error;
    if ((error as PrismaClientKnownRequestError).code === 'P2001') {
      return { error: 'Partner not found.' };
    }
    if ((error as PrismaClientKnownRequestError).code === 'P2002') {
      return { error: 'A partner with this email already exists.' };
    }
    console.error('Failed to update partner:', error);
    return { error: 'Unable to update partner. Please try again.' };
  }

  revalidatePath('/admin/partners');
  revalidatePath(`/admin/partners/${partnerId}`);
  redirect('/admin/partners?updated=1');
}

export async function deletePartner(partnerId: string) {
  if (!objectIdRegex.test(partnerId)) {
    redirect('/admin/partners');
  }

  const partner = await prisma.partner.findUnique({ where: { id: partnerId }, select: { userId: true } });

  await prisma.user.updateMany({ where: { partnerId }, data: { partnerId: null } });
  await prisma.booking.updateMany({ where: { partnerId }, data: { partnerId: null } });
  await prisma.partner.delete({ where: { id: partnerId } });

  if (partner?.userId) {
    await prisma.user.delete({ where: { id: partner.userId } }).catch(() => {});
  }

  revalidatePath('/admin/partners');
  redirect('/admin/partners?deleted=1');
}
