import { getAdminSettingsClient } from "@/app/admin/settings/adminSettingsClient";
import {
  TAX_PERCENTAGE_SETTING_KEY,
  STRIPE_FEE_PERCENTAGE_SETTING_KEY,
  EXTRA_FEE_AMOUNT_SETTING_KEY,
  parsePercentageSetting,
  parseNonNegativeNumberSetting,
} from "@/app/admin/settings/pricingConstants";

export type PricingAdjustmentConfig = {
  taxPercentage: number | null;
  stripeFeePercentage: number | null;
  extraFeeAmountCents: number | null;
};

export async function loadPricingAdjustmentConfig(): Promise<PricingAdjustmentConfig> {
  const client = getAdminSettingsClient();
  if (!client) {
    return {
      taxPercentage: null,
      stripeFeePercentage: null,
      extraFeeAmountCents: null,
    };
  }

  const rows = await client.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const taxPercentage = parsePercentageSetting(map.get(TAX_PERCENTAGE_SETTING_KEY) ?? null);
  const stripeFeePercentage = parsePercentageSetting(map.get(STRIPE_FEE_PERCENTAGE_SETTING_KEY) ?? null);
  const extraFeeAmount = parseNonNegativeNumberSetting(map.get(EXTRA_FEE_AMOUNT_SETTING_KEY) ?? null);

  return {
    taxPercentage: taxPercentage ?? null,
    stripeFeePercentage: stripeFeePercentage ?? null,
    extraFeeAmountCents: extraFeeAmount !== null ? Math.round(extraFeeAmount * 100) : null,
  };
}
