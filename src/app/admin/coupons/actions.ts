'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

function getRequired(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

function getOptional(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseBoolean(value: string | null | undefined): boolean {
  return value === 'true' || value === 'on';
}

function parseOptionalInt(value: string | null, key: string, allowZero = true): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new Error(`Invalid value for ${key}`);
  }
  return parsed;
}

function parseMoney(value: string | null, key: string): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${key}`);
  }
  return Math.round(parsed * 100);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  return date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const couponClient = (prisma as any).coupon;

type CouponPayload = {
  code: string;
  name: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'AMOUNT';
  discountValue: number;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number | null;
  minBookingAmountCents: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
  appliesToAllServices: boolean;
  applicableServiceIds: string[];
};

function buildCouponData(formData: FormData): CouponPayload {
  const code = getRequired(formData, 'code').toUpperCase();
  const name = getRequired(formData, 'name');
  const description = getOptional(formData, 'description');

  const discountTypeRaw = getRequired(formData, 'discountType');
  if (discountTypeRaw !== 'PERCENTAGE' && discountTypeRaw !== 'AMOUNT') {
    throw new Error('Invalid discount type');
  }
  const discountType = discountTypeRaw as 'PERCENTAGE' | 'AMOUNT';

  const discountValueRaw = getRequired(formData, 'discountValue');
  let discountValue: number;
  if (discountType === 'PERCENTAGE') {
    const parsed = Number.parseInt(discountValueRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      throw new Error('Percentage discount must be between 0 and 100');
    }
    discountValue = parsed;
  } else {
    const cents = parseMoney(discountValueRaw, 'discountValue');
    if (cents === null || cents <= 0) {
      throw new Error('Discount amount must be greater than zero');
    }
    discountValue = cents;
  }

  const maxRedemptions = parseOptionalInt(getOptional(formData, 'maxRedemptions'), 'maxRedemptions');
  const maxPerUser = parseOptionalInt(getOptional(formData, 'maxRedemptionsPerUser'), 'maxRedemptionsPerUser');
  const minBookingAmountCents = parseMoney(getOptional(formData, 'minBookingAmount'), 'minBookingAmount');

  const validFrom = parseDate(getOptional(formData, 'validFrom'));
  const validUntil = parseDate(getOptional(formData, 'validUntil'));

  if (validFrom && validUntil && validFrom > validUntil) {
    throw new Error('Valid until must be after valid from');
  }

  const active = parseBoolean(getOptional(formData, 'active'));
  const appliesToAllServices = parseBoolean(getOptional(formData, 'appliesToAllServices'));

  let applicableServiceIds: string[] = [];
  if (!appliesToAllServices) {
    const serviceIds = formData.getAll('serviceIds').filter((value): value is string => typeof value === 'string');
    if (serviceIds.length === 0) {
      throw new Error('Select at least one service');
    }
    applicableServiceIds = Array.from(new Set(serviceIds));
  }

  return {
    code,
    name,
    description,
    discountType,
    discountValue,
    maxRedemptions,
    maxRedemptionsPerUser: maxPerUser,
    minBookingAmountCents,
    validFrom,
    validUntil,
    active,
    appliesToAllServices,
    applicableServiceIds,
  } as CouponPayload;
}

export async function createCoupon(formData: FormData) {
  const session = await requireAdminSession();
  const adminId = (session.user as { id: string }).id;
  const data = buildCouponData(formData);

  await couponClient.create({ data: { ...data, createdByAdminId: adminId } });

  revalidatePath('/admin/coupons');
  redirect('/admin/coupons');
}

export async function updateCoupon(formData: FormData) {
  await requireAdminSession();
  const id = getRequired(formData, 'id');
  const data = buildCouponData(formData);

  await couponClient.update({ where: { id }, data });

  revalidatePath('/admin/coupons');
  revalidatePath(`/admin/coupons/${id}`);
  redirect('/admin/coupons');
}

export async function toggleCouponActive(formData: FormData) {
  await requireAdminSession();
  const id = getRequired(formData, 'id');
  const current = parseBoolean(getOptional(formData, 'active'));

  await couponClient.update({ where: { id }, data: { active: !current } });

  revalidatePath('/admin/coupons');
  revalidatePath(`/admin/coupons/${id}`);
}

export async function deleteCoupon(formData: FormData) {
  await requireAdminSession();
  const id = getRequired(formData, 'id');
  const redirectTo = getOptional(formData, 'redirectTo');

  await prisma.$transaction([
    prisma.couponRedemption.deleteMany({
      where: { couponId: id },
    }),
    couponClient.delete({ where: { id } }),
  ]);

  revalidatePath('/admin/coupons');
  revalidatePath(`/admin/coupons/${id}`);
  if (redirectTo) {
    redirect(redirectTo);
  }
}
