'use server';

import { revalidatePath } from 'next/cache';
import { getAdminSettingsClient } from './adminSettingsClient';
import {
  DEFAULT_PARTNER_COMMISSION_SETTING_KEY,
  TAX_PERCENTAGE_SETTING_KEY,
  LOYALTY_POINTS_PER_AED_SETTING_KEY,
  LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY,
  FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY,
  STRIPE_FEE_PERCENTAGE_SETTING_KEY,
  EXTRA_FEE_AMOUNT_SETTING_KEY,
} from "./pricingConstants";

type SettingPayload = Record<string, string | null | undefined>;

async function persistSettings(payload: SettingPayload) {
  const adminSettings = getAdminSettingsClient();
  if (!adminSettings) {
    return;
  }

  await Promise.all(
    Object.entries(payload).map(async ([key, rawValue]) => {
      if (typeof rawValue === 'undefined' || rawValue === null) {
        return;
      }

      await adminSettings.upsert({
        where: { key },
        create: { key, value: rawValue },
        update: { value: rawValue },
      });
    }),
  );

  revalidatePath('/admin/settings');
  revalidatePath('/admin');
}

function extractBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on' ? 'true' : 'false';
}

export async function saveGeneralSettings(formData: FormData) {
  await persistSettings({
    organisation_name: formData.get('organisation_name')?.toString().trim() ?? '',
    support_email: formData.get('support_email')?.toString().trim() ?? '',
    timezone: formData.get('timezone')?.toString().trim() ?? 'Asia/Dubai',
  });
}

export async function saveNotificationSettings(formData: FormData) {
  const rawNotice = formData.get('customer_notice');
  const customerNotice =
    typeof rawNotice === 'string'
      ? rawNotice.trim()
      : rawNotice != null
      ? String(rawNotice).trim()
      : '';

  await persistSettings({
    notify_new_orders: extractBoolean(formData, 'notify_new_orders'),
    notify_driver_status: extractBoolean(formData, 'notify_driver_status'),
    weekly_digest_enabled: extractBoolean(formData, 'weekly_digest_enabled'),
    digest_day: formData.get('digest_day')?.toString() ?? 'Monday',
    customer_notice: customerNotice,
  });
}

export async function saveOperationsSettings(formData: FormData) {
  await persistSettings({
    auto_assign_drivers: extractBoolean(formData, 'auto_assign_drivers'),
    default_service_window: formData.get('default_service_window')?.toString() ?? '90',
    business_hours_start: formData.get('business_hours_start')?.toString() ?? '08:00',
    business_hours_end: formData.get('business_hours_end')?.toString() ?? '19:00',
    enable_cash_collection: extractBoolean(formData, 'enable_cash_collection'),
    driverDutyStartTime: formData.get('driverDutyStartTime')?.toString() ?? '',
    driverDutyEndTime: formData.get('driverDutyEndTime')?.toString() ?? '',
  });
}

function normalizePercentageInput(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed === '') {
    return '';
  }
  const parsed = Number.parseFloat(trimmed.replace(/,/g, '.'));
  if (!Number.isFinite(parsed)) {
    return '';
  }
  const bounded = Math.min(Math.max(parsed, 0), 100);
  const normalized = Number.parseFloat(bounded.toFixed(2));
  return normalized.toString();
}

function normalizePositiveIntInput(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '';
  }
  return parsed.toString();
}

function normalizeNonNegativeCurrencyInput(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const parsed = Number.parseFloat(trimmed.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return '';
  }
  const normalized = Number.parseFloat(parsed.toFixed(2));
  return normalized.toString();
}

export async function savePricingSettings(formData: FormData) {
  const taxPercentage = normalizePercentageInput(formData.get('tax_percentage'));
  const defaultCommission = normalizePercentageInput(formData.get('default_partner_commission'));
  const stripeFeePercentage = normalizePercentageInput(formData.get('stripe_fee_percentage'));
  const extraFeeAmount = normalizeNonNegativeCurrencyInput(formData.get('extra_fee_amount'));

  await persistSettings({
    [TAX_PERCENTAGE_SETTING_KEY]: taxPercentage,
    [DEFAULT_PARTNER_COMMISSION_SETTING_KEY]: defaultCommission,
    [STRIPE_FEE_PERCENTAGE_SETTING_KEY]: stripeFeePercentage,
    [EXTRA_FEE_AMOUNT_SETTING_KEY]: extraFeeAmount,
  });

  revalidatePath('/admin/partners/new');
  revalidatePath('/admin/partners');
}

export async function savePromotionsSettings(formData: FormData) {
  const loyaltyPointsPerAed = normalizePositiveIntInput(formData.get("loyalty_points_per_aed"));
  const loyaltyPointsPerCreditAed = normalizePositiveIntInput(formData.get("loyalty_points_per_credit_aed"));
  const freeWashEveryN = normalizePositiveIntInput(formData.get("free_wash_every_n_bookings"));
  await persistSettings({
    [LOYALTY_POINTS_PER_AED_SETTING_KEY]: loyaltyPointsPerAed,
    [LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY]: loyaltyPointsPerCreditAed,
    [FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY]: freeWashEveryN,
  });
}

export async function saveUserFeatures(formData: FormData) {
  await persistSettings({
    enableCoupons: extractBoolean(formData, 'enableCoupons'),
    enableLoyalty: extractBoolean(formData, 'enableLoyalty'),
    driverTabOverview: extractBoolean(formData, 'driverTabOverview'),
    driverTabAssignments: extractBoolean(formData, 'driverTabAssignments'),
    driverTabCash: extractBoolean(formData, 'driverTabCash'),
    partnerTabAssignments: extractBoolean(formData, 'partnerTabAssignments'),
    partnerTabDrivers: extractBoolean(formData, 'partnerTabDrivers'),
    partnerTabEarnings: extractBoolean(formData, 'partnerTabEarnings'),
  });
}
