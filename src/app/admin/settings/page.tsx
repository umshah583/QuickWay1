import { getAdminSettingsClient } from "./adminSettingsClient";
import { saveGeneralSettings, saveNotificationSettings, saveOperationsSettings } from "./actions";

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

export default async function AdminSettingsPage() {
  const settings = await loadSettings();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Settings</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Tailor the admin experience, notification policies, and operational defaults for your team.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2 space-y-6">
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

          <form action={saveOperationsSettings} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-[var(--text-strong)]">Operations</h2>
              <p className="text-sm text-[var(--text-muted)]">Control how jobs are assigned and the working window your team observes.</p>
            </header>
            <fieldset className="space-y-4">
              <label className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
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
              <label className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
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
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm">
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
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Business hours start</span>
                <input
                  type="time"
                  name="business_hours_start"
                  defaultValue={settings.business_hours_start ?? "08:00"}
                  className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--text-strong)]">Business hours end</span>
                <input
                  type="time"
                  name="business_hours_end"
                  defaultValue={settings.business_hours_end ?? "19:00"}
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
