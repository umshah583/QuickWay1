export const TAX_PERCENTAGE_SETTING_KEY = "64bf00000000000000000002";
export const DEFAULT_PARTNER_COMMISSION_SETTING_KEY = "64bf00000000000000000003";
export const STRIPE_FEE_PERCENTAGE_SETTING_KEY = "64bf00000000000000000008";
export const EXTRA_FEE_AMOUNT_SETTING_KEY = "64bf00000000000000000009";
export const FEATURED_PROMOTIONS_SETTING_KEY = "64bf00000000000000000010";

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

export function parseNonNegativeNumberSetting(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export type FeaturedPromotionSetting = {
  title: string;
  description: string;
  savingsLabel: string;
  ctaLabel?: string;
  ctaLink?: string;
  serviceId?: string;
};

export function parseFeaturedPromotionsSetting(value: string | null | undefined): FeaturedPromotionSetting[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => ({
        title: typeof item?.title === "string" ? item.title.trim() : "",
        description: typeof item?.description === "string" ? item.description.trim() : "",
        savingsLabel: typeof item?.savingsLabel === "string" ? item.savingsLabel.trim() : "",
        ctaLabel: typeof item?.ctaLabel === "string" ? item.ctaLabel.trim() : undefined,
        ctaLink: typeof item?.ctaLink === "string" ? item.ctaLink.trim() : undefined,
        serviceId: typeof item?.serviceId === "string" ? item.serviceId.trim() : undefined,
      }))
      .filter((item) => item.title && item.description && item.savingsLabel);
  } catch (error) {
    console.error("Failed to parse featured promotions setting", error);
    return [];
  }
}
