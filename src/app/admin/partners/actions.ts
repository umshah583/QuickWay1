'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { getPartnerPayoutDelegate } from '@/lib/partnerPayout';
import { requireAdminSession } from '@/lib/admin-auth';
import { DEFAULT_PARTNER_COMMISSION_SETTING_KEY, parsePercentageSetting } from '../settings/pricingConstants';
import { loadPartnerFinancialSnapshot } from './financials';

const objectIdRegex = /^[a-f\d]{24}$/i;

const partnerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .or(z.literal(''))
    .transform((value) => (value === '' ? null : value)),
  commissionPercentage: z
    .string()
    .trim()
    .transform((raw) => {
      if (raw === '') return null;
      const parsed = Number.parseFloat(raw.replace(/,/g, '.'));
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((value) => value === null || !Number.isNaN(value), {
      message: 'Commission percentage must be a number.',
    })
    .refine((value) => value === null || (value >= 0 && value <= 100), {
      message: 'Commission percentage must be between 0 and 100.',
    }),
});

type PartnerInput = z.infer<typeof partnerSchema>;

export type PartnerFormState = {
  error?: string;
};

const payoutSchema = z.object({
  amount: z
    .string()
    .transform((value) => Number.parseFloat(value.replace(/,/g, '.')))
    .refine((value) => Number.isFinite(value) && value > 0, 'Enter a valid payout amount'),
  note: z.string().trim().max(500, 'Note is too long').optional(),
});

export type PartnerPayoutFormState = {
  error?: string;
  success?: boolean;
};

export async function getDefaultCommissionPercentage() {
  const setting = await prisma.adminSetting.findUnique({ where: { key: DEFAULT_PARTNER_COMMISSION_SETTING_KEY } });
  return parsePercentageSetting(setting?.value);
}

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
  const { name, email, commissionPercentage } = parsed;
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
    const effectiveCommission = commissionPercentage ?? (await getDefaultCommissionPercentage());
    const partner = await prisma.partner.create({
      data: {
        name,
        email,
        commissionPercentage: effectiveCommission ?? undefined,
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
  const { name, email, commissionPercentage } = parsed;
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
    const effectiveCommission = commissionPercentage ?? (await getDefaultCommissionPercentage());
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        name,
        email,
        commissionPercentage: effectiveCommission ?? undefined,
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
}

export async function createPartnerPayout(
  partnerId: string,
  prevState: PartnerPayoutFormState,
  formData: FormData,
): Promise<PartnerPayoutFormState> {
  if (!objectIdRegex.test(partnerId)) {
    return { error: 'Invalid partner identifier.' };
  }

  const adminSession = await requireAdminSession();
  const adminId = adminSession.user?.id ?? null;

  const parsed = payoutSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid payout details';
    return { error: firstError };
  }

  const { amount, note } = parsed.data;
  const amountCents = Math.round(amount * 100);
  if (amountCents <= 0) {
    return { error: 'Payout amount must be greater than zero.' };
  }

  const snapshot = await loadPartnerFinancialSnapshot(partnerId);
  if (!snapshot) {
    return { error: 'Partner not found.' };
  }

  if (amountCents > snapshot.outstandingCents) {
    return {
      error: `Amount exceeds outstanding balance of AED ${(snapshot.outstandingCents / 100).toFixed(2)}.`,
    };
  }

  const now = new Date();
  const periodMonth = now.getMonth() + 1;
  const periodYear = now.getFullYear();

  const partnerPayout = getPartnerPayoutDelegate();

  await partnerPayout.create({
    data: {
      partnerId,
      amountCents,
      note: note && note.length > 0 ? note : null,
      periodMonth,
      periodYear,
      createdByAdminId: adminId ?? undefined,
    },
  });

  revalidatePath('/admin/partners');
  revalidatePath(`/admin/partners/${partnerId}`);

  return { success: true };
}
