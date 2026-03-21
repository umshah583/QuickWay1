import { getAdminSettingsClient } from "../settings/adminSettingsClient";
import { savePromotionsSettings } from "../settings/actions";
import {
  LOYALTY_POINTS_PER_AED_SETTING_KEY,
  LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY,
} from "../settings/pricingConstants";
import PageHeader from "@/app/components/PageHeader";

export const dynamic = "force-dynamic";

type SettingMap = Record<string, string | null>;

async function loadSettings(): Promise<SettingMap> {
  const client = getAdminSettingsClient();
  if (!client) return {};

  const rows = await client.findMany();
  return rows.reduce((acc: SettingMap, row: { key: string; value: string | null }) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export default async function LoyaltyPage() {
  const settings = await loadSettings();
  const loyaltyPointsPerAedRaw = settings[LOYALTY_POINTS_PER_AED_SETTING_KEY] ?? null;
  const loyaltyPointsPerCreditAedRaw = settings[LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY] ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Loyalty Program"
        description="Configure loyalty points earning and redemption rules for customers."
      />

      <form action={savePromotionsSettings} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-[var(--text-strong)]">Loyalty Points Configuration</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Set how many points customers earn per AED spent and how many points they must redeem for 1 AED of credit.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Loyalty points per 1 AED</span>
            <input
              type="number"
              name="loyalty_points_per_aed"
              min={1}
              step={1}
              defaultValue={loyaltyPointsPerAedRaw ?? ""}
              placeholder="e.g. 1"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
            <span className="text-xs text-[var(--text-muted)]">
              Example: set to 2 to give 2 points for every 1 AED spent.
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Points required to redeem 1 AED credit</span>
            <input
              type="number"
              name="loyalty_points_per_credit_aed"
              min={1}
              step={1}
              defaultValue={loyaltyPointsPerCreditAedRaw ?? ""}
              placeholder="e.g. 10"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
            <span className="text-xs text-[var(--text-muted)]">
              Example: set to 10 so 10 points redeem as 1 AED of credit.
            </span>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
          >
            Save loyalty settings
          </button>
        </div>
      </form>
    </div>
  );
}
