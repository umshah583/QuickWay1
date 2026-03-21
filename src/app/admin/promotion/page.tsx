import { getAdminSettingsClient } from "../settings/adminSettingsClient";
import { savePromotionsSettings } from "../settings/actions";
import {
  FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY,
  FEATURED_PROMOTIONS_SETTING_KEY,
  parseFeaturedPromotionsSetting,
} from "../settings/pricingConstants";
import FeaturedPromotionsManager from "../settings/FeaturedPromotionsManager";
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

export default async function PromotionPage() {
  const settings = await loadSettings();
  const freeWashEveryNRaw = settings[FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY] ?? null;
  const featuredPromotions = parseFeaturedPromotionsSetting(settings[FEATURED_PROMOTIONS_SETTING_KEY] ?? null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotions"
        description="Manage promotional campaigns, free wash programs, and featured promotions."
      />

      <form action={savePromotionsSettings} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-[var(--text-strong)]">Free Wash Program</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Configure how many washes unlock a free service for customers.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Free wash after N completed washes</span>
            <input
              type="number"
              name="free_wash_every_n_bookings"
              min={1}
              step={1}
              defaultValue={freeWashEveryNRaw ?? ""}
              placeholder="e.g. 4"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
            <span className="text-xs text-[var(--text-muted)]">
              Example: set to 4 to make every 4th completed wash free.
            </span>
          </label>
        </div>

        <FeaturedPromotionsManager initialItems={featuredPromotions} />

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
          >
            Save promotion settings
          </button>
        </div>
      </form>
    </div>
  );
}
