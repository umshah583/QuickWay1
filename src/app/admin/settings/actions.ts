'use server';

import { revalidatePath } from 'next/cache';
import { getAdminSettingsClient } from './adminSettingsClient';
import { DEFAULT_PARTNER_COMMISSION_SETTING_KEY, TAX_PERCENTAGE_SETTING_KEY } from './pricingConstants';

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
  await persistSettings({
    notify_new_orders: extractBoolean(formData, 'notify_new_orders'),
    notify_driver_status: extractBoolean(formData, 'notify_driver_status'),
    weekly_digest_enabled: extractBoolean(formData, 'weekly_digest_enabled'),
    digest_day: formData.get('digest_day')?.toString() ?? 'Monday',
  });
}

export async function saveOperationsSettings(formData: FormData) {
  await persistSettings({
    auto_assign_drivers: extractBoolean(formData, 'auto_assign_drivers'),
    default_service_window: formData.get('default_service_window')?.toString() ?? '90',
    business_hours_start: formData.get('business_hours_start')?.toString() ?? '08:00',
    business_hours_end: formData.get('business_hours_end')?.toString() ?? '19:00',
    enable_cash_collection: extractBoolean(formData, 'enable_cash_collection'),
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

export async function savePricingSettings(formData: FormData) {
  const taxPercentage = normalizePercentageInput(formData.get('tax_percentage'));
  const defaultCommission = normalizePercentageInput(formData.get('default_partner_commission'));

  await persistSettings({
    [TAX_PERCENTAGE_SETTING_KEY]: taxPercentage,
    [DEFAULT_PARTNER_COMMISSION_SETTING_KEY]: defaultCommission,
  });

  revalidatePath('/admin/partners/new');
  revalidatePath('/admin/partners');
}
