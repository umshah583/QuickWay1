export const TAX_PERCENTAGE_SETTING_KEY = "64bf00000000000000000002";
export const DEFAULT_PARTNER_COMMISSION_SETTING_KEY = "64bf00000000000000000003";

// Promotions & loyalty settings
export const GLOBAL_DISCOUNT_PERCENTAGE_SETTING_KEY = "64bf00000000000000000004";
export const LOYALTY_POINTS_PER_AED_SETTING_KEY = "64bf00000000000000000005";
export const FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY = "64bf00000000000000000006";
export const LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY = "64bf00000000000000000007";

export function parsePercentageSetting(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}
