import { getAdminSettingsClient } from "./adminSettingsClient";
import {
  saveGeneralSettings,
  saveNotificationSettings,
  saveOperationsSettings,
  savePricingSettings,
  savePromotionsSettings,
  saveUserFeatures,
} from "./actions";
import {
  DEFAULT_PARTNER_COMMISSION_SETTING_KEY,
  TAX_PERCENTAGE_SETTING_KEY,
  LOYALTY_POINTS_PER_AED_SETTING_KEY,
  LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY,
  FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY,
  parsePercentageSetting,
} from "./pricingConstants";
import PageHeader from "@/app/components/PageHeader";
import { getFeatureFlags } from "@/lib/admin-settings";

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

type TabId = "organisation" | "notifications" | "operations" | "pricing" | "promotions" | "features";

const tabs: { id: TabId; label: string; description: string }[] = [
  { id: "organisation", label: "Organisation", description: "Company identity & contact info" },
  { id: "notifications", label: "Notifications", description: "Who gets alerted and when" },
  { id: "operations", label: "Operations", description: "Job assignment & working hours" },
  { id: "pricing", label: "Pricing & Revenue", description: "Tax and commission defaults" },
  { id: "promotions", label: "Promotions & Loyalty", description: "Free wash cadence & points" },
  { id: "features", label: "User Features", description: "Toggle coupons & loyalty for users" },
];

function resolveActiveTab(requested?: string | null): TabId {
  if (!requested) return "organisation";
  return tabs.some((tab) => tab.id === requested) ? (requested as TabId) : "organisation";
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const settings = await loadSettings();
  const taxPercentage = parsePercentageSetting(settings[TAX_PERCENTAGE_SETTING_KEY] ?? null);
  const defaultCommission = parsePercentageSetting(settings[DEFAULT_PARTNER_COMMISSION_SETTING_KEY] ?? null);
  const loyaltyPointsPerAedRaw = settings[LOYALTY_POINTS_PER_AED_SETTING_KEY] ?? null;
  const loyaltyPointsPerCreditAedRaw = settings[LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY] ?? null;
  const freeWashEveryNRaw = settings[FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY] ?? null;
  const featureFlags = await getFeatureFlags();
  const params = searchParams ? await searchParams : undefined;
  const activeTab = resolveActiveTab(params?.tab);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Tailor the admin experience, notification policies, and operational defaults for your team."
      />

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-4 shadow-sm">
        <nav className="flex flex-wrap gap-2" aria-label="Settings tabs">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <a
                key={tab.id}
                href={`?tab=${tab.id}`}
                className={`flex flex-col rounded-xl border px-4 py-3 text-sm transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] ${
                  isActive
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                <span className="font-semibold text-[var(--text-strong)]">{tab.label}</span>
                <span className="text-xs text-[var(--text-muted)]">{tab.description}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2 space-y-6">
          {activeTab === "organisation" ? (
            <form action={saveGeneralSettings} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-[var(--text-strong)]">Organisation</h2>
              <p className="text-sm text-[var(--text-muted)]">Update how the platform refers to your business and how customers reach you.</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Organisation name</span>
                <input
                  type="text"
                  name="organisation_name"
                  defaultValue={settings.organisation_name ?? "Quickway"}
                  placeholder="Quickway Car Care"
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Support email</span>
                <input
                  type="email"
                  name="support_email"
                  defaultValue={settings.support_email ?? "support@quickway.com"}
                  placeholder="support@example.com"
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Default timezone</span>
                <select
                  name="timezone"
                  defaultValue={settings.timezone ?? "Asia/Dubai"}
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                >
                  <option value="Asia/Dubai">GMT+4 — Gulf Standard Time</option>
                  <option value="Asia/Kolkata">GMT+5:30 — India</option>
                  <option value="Europe/London">GMT+0 — London</option>
                  <option value="America/New_York">GMT-5 — New York</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Customer portal URL</span>
                <input
                  type="url"
                  name="customer_portal"
                  defaultValue={settings.customer_portal ?? "https://quickway.app/book"}
                  placeholder="https://yourdomain.com/book"
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
              >
                Save organisation settings
              </button>
            </div>
            </form>
          ) : null}

          {activeTab === "notifications" ? (
            <form action={saveNotificationSettings} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-[var(--text-strong)]">Notifications</h2>
              <p className="text-sm text-[var(--text-muted)]">Choose which events trigger alerts and how digest summaries behave.</p>
            </header>
            <fieldset className="space-y-4">
              <label className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  name="notify_new_orders"
                  defaultChecked={(settings.notify_new_orders ?? "true") === "true"}
                  className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                />
                <span>
                  <span className="font-medium text-[var(--text-strong)]">Alert admins on new bookings</span>
                  <br />
                  Email and in-app notifications whenever a customer confirms an order.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  name="notify_driver_status"
                  defaultChecked={(settings.notify_driver_status ?? "true") === "true"}
                  className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                />
                <span>
                  <span className="font-medium text-[var(--text-strong)]">Notify when drivers change status</span>
                  <br />
                  Receive alerts when a driver goes on-duty, completes a job, or misses an SLA.
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  name="weekly_digest_enabled"
                  defaultChecked={(settings.weekly_digest_enabled ?? "false") === "true"}
                  className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                />
                <span>
                  <span className="font-medium text-[var(--text-strong)]">Send weekly performance digest</span>
                  <br />
                  Summary email covering revenue, customer growth, and driver utilisation.
                </span>
              </label>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Digest send day</span>
                <select
                  name="digest_day"
                  defaultValue={settings.digest_day ?? "Monday"}
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                >
                  <option>Monday</option>
                  <option>Tuesday</option>
                  <option>Wednesday</option>
                  <option>Thursday</option>
                  <option>Friday</option>
                  <option>Saturday</option>
                  <option>Sunday</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
              >
                Save notification settings
              </button>
            </div>
            </form>
          ) : null}

          {activeTab === "operations" ? (
            <form action={saveOperationsSettings} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
              <header className="space-y-1">
                <h2 className="text-xl font-semibold text-[var(--text-strong)]">Operations</h2>
                <p className="text-sm text-[var(--text-muted)]">Control how jobs are assigned and the working window your team observes.</p>
              </header>
              <fieldset className="space-y-3">
                <label className="flex items-start gap-3 rounded-lg border border-[var(--surface-border)] bg-white/70 p-4 text-sm text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    name="auto_assign_drivers"
                    defaultChecked={(settings.auto_assign_drivers ?? "true") === "true"}
                    className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                  />
                  <span>
                    <span className="font-medium text-[var(--text-strong)]">Auto-assign drivers</span>
                    <br />
                    Match bookings to available drivers automatically based on proximity and workload.
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-[var(--surface-border)] bg-white/70 p-4 text-sm text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    name="enable_cash_collection"
                    defaultChecked={(settings.enable_cash_collection ?? "true") === "true"}
                    className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                  />
                  <span>
                    <span className="font-medium text-[var(--text-strong)]">Allow cash collection</span>
                    <br />
                    Permit drivers to log cash payments collected on-site for reconciliation.
                  </span>
                </label>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex h-full flex-col justify-end gap-2 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Default service window (minutes)</span>
                  <input
                    type="number"
                    min={30}
                    max={240}
                    step={15}
                    name="default_service_window"
                    defaultValue={settings.default_service_window ?? "90"}
                    className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </label>
                <label className="flex h-full flex-col justify-end gap-2 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Business hours start</span>
                  <input
                    type="time"
                    name="business_hours_start"
                    defaultValue={settings.business_hours_start ?? "08:00"}
                    className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </label>
                <label className="flex h-full flex-col justify-end gap-2 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Business hours end</span>
                  <input
                    type="time"
                    name="business_hours_end"
                    defaultValue={settings.business_hours_end ?? "19:00"}
                    className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </label>
                <label className="flex h-full flex-col justify-end gap-2 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Driver duty start time</span>
                  <input
                    type="time"
                    name="driverDutyStartTime"
                    defaultValue={settings.driverDutyStartTime ?? "09:00"}
                    className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </label>
                <label className="flex h-full flex-col justify-end gap-2 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Driver duty end time</span>
                  <input
                    type="time"
                    name="driverDutyEndTime"
                    defaultValue={settings.driverDutyEndTime ?? "18:00"}
                    className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                >
                  Save operations settings
                </button>
              </div>
            </form>
          ) : null}

          {activeTab === "pricing" ? (
            <form action={savePricingSettings} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-[var(--text-strong)]">Pricing &amp; revenue</h2>
              <p className="text-sm text-[var(--text-muted)]">
                Define tax rates and the default partner commission used when new partners are created.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Tax percentage (VAT)</span>
                <input
                  type="number"
                  name="tax_percentage"
                  min={0}
                  max={100}
                  step={0.1}
                  defaultValue={taxPercentage ?? ""}
                  placeholder="e.g. 5"
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
                <span className="text-xs text-[var(--text-muted)]">
                  Used when generating invoices and summaries.
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Default partner commission (%)</span>
                <input
                  type="number"
                  name="default_partner_commission"
                  min={0}
                  max={100}
                  step={0.1}
                  defaultValue={defaultCommission ?? ""}
                  placeholder="e.g. 20"
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
                <span className="text-xs text-[var(--text-muted)]">
                  Used as the starting commission when adding a new partner.
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
              >
                Save pricing settings
              </button>
            </div>
            </form>
          ) : null}

          {activeTab === "promotions" ? (
            <form action={savePromotionsSettings} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-[var(--text-strong)]">Promotions &amp; loyalty</h2>
              <p className="text-sm text-[var(--text-muted)]">
              Configure how many washes unlock a free service, how many points customers earn per AED, and how many points they must redeem for 1 AED of credit.
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
                Save promotions settings
              </button>
            </div>
            </form>
          ) : null}

          {activeTab === "features" ? (
            <form action={saveUserFeatures} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
              <header className="space-y-1">
                <h2 className="text-xl font-semibold text-[var(--text-strong)]">User Features</h2>
                <p className="text-sm text-[var(--text-muted)]">Control whether customers can access loyalty perks and coupons.</p>
              </header>
              <div className="space-y-4">
                <label className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    name="enableCoupons"
                    defaultChecked={featureFlags.enableCoupons}
                    className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                  />
                  <span>
                    <span className="font-medium text-[var(--text-strong)]">Enable Coupon System</span>
                    <br />
                    Allow customers to apply coupon codes on pending bookings and checkout.
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    name="enableLoyalty"
                    defaultChecked={featureFlags.enableLoyalty}
                    className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                  />
                  <span>
                    <span className="font-medium text-[var(--text-strong)]">Enable Loyalty Program</span>
                    <br />
                    Show loyalty points accrual and free-wash progress across the customer dashboard.
                  </span>
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-[var(--surface-border)] bg-white/70 p-4">
                  <header className="space-y-1">
                    <h3 className="text-sm font-semibold text-[var(--text-strong)]">Driver dashboard tabs</h3>
                    <p className="text-xs text-[var(--text-muted)]">Pick which modules appear in the driver sidebar.</p>
                  </header>
                  <div className="mt-3 space-y-3 text-sm text-[var(--text-muted)]">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="driverTabOverview"
                        defaultChecked={featureFlags.driverTabOverview}
                        className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                      />
                      <span>
                        <span className="font-medium text-[var(--text-strong)]">Overview cards</span>
                        <br />
                        Show KPIs such as assigned jobs and cash totals.
                      </span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="driverTabAssignments"
                        defaultChecked={featureFlags.driverTabAssignments}
                        className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                      />
                      <span>
                        <span className="font-medium text-[var(--text-strong)]">Assignments</span>
                        <br />
                        Allow drivers to view the job queue and task actions.
                      </span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="driverTabCash"
                        defaultChecked={featureFlags.driverTabCash}
                        className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                      />
                      <span>
                        <span className="font-medium text-[var(--text-strong)]">Cash collection</span>
                        <br />
                        Allow cash logging and settlement forms inside jobs.
                      </span>
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-[var(--surface-border)] bg-white/70 p-4">
                  <header className="space-y-1">
                    <h3 className="text-sm font-semibold text-[var(--text-strong)]">Partner dashboard tabs</h3>
                    <p className="text-xs text-[var(--text-muted)]">Control partner-side navigation items.</p>
                  </header>
                  <div className="mt-3 space-y-3 text-sm text-[var(--text-muted)]">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="partnerTabAssignments"
                        defaultChecked={featureFlags.partnerTabAssignments}
                        className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                      />
                      <span>
                        <span className="font-medium text-[var(--text-strong)]">Assignments</span>
                        <br />
                        Show booking/job analytics to partners.
                      </span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="partnerTabDrivers"
                        defaultChecked={featureFlags.partnerTabDrivers}
                        className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                      />
                      <span>
                        <span className="font-medium text-[var(--text-strong)]">Drivers</span>
                        <br />
                        Allow roster insights and driver requests.
                      </span>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        name="partnerTabEarnings"
                        defaultChecked={featureFlags.partnerTabEarnings}
                        className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                      />
                      <span>
                        <span className="font-medium text-[var(--text-strong)]">Earnings</span>
                        <br />
                        Expose settlement progress and invoice breakdowns.
                      </span>
                    </label>
                  </div>
                </section>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                >
                  Save user feature settings
                </button>
              </div>
            </form>
          ) : null}
        </article>

        <aside className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 text-sm text-[var(--text-muted)]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Need to integrate?</h3>
          <p>
            Settings you configure here sync across the admin dashboard. Coming soon: webhooks, accounting integrations, and Slack alerts for
            bookings and driver events.
          </p>
          <p>
            To request additional configuration options, reach out to the Quickway support team and we&rsquo;ll prioritise them on the roadmap.
          </p>
        </aside>
      </section>
    </div>
  );
}
