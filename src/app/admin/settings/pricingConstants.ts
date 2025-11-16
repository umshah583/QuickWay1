export const TAX_PERCENTAGE_SETTING_KEY = "64bf00000000000000000002";
export const DEFAULT_PARTNER_COMMISSION_SETTING_KEY = "64bf00000000000000000003";

export function parsePercentageSetting(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}
