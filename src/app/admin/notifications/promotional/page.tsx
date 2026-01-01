import Link from 'next/link';
import { sendPromotionalNotification } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function PromotionalNotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const success = parseParam(params.success) === 'true';
  const error = parseParam(params.error) === 'true';
  const message = parseParam(params.message);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Promotional Notifications</h1>
        <p className="text-sm text-[var(--text-muted)]">Send promotional push notifications to all customers or drivers.</p>
      </header>

      {success && message && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium">Success</p>
              <p className="text-sm">{message}</p>
            </div>
          </div>
        </div>
      )}

      {error && message && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium">Error</p>
              <p className="text-sm">{message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 p-6">
          <h2 className="text-xl font-semibold text-[var(--text-strong)] mb-4">Send Promotional Notification</h2>

          <form action={sendPromotionalNotification} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="appType" className="block text-sm font-medium text-[var(--text-strong)]">
                Target Audience
              </label>
              <select
                id="appType"
                name="appType"
                required
                className="w-full h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              >
                <option value="">Select audience...</option>
                <option value="CUSTOMER">All Customers</option>
                <option value="DRIVER">All Drivers</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-[var(--text-strong)]">
                Notification Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                maxLength={100}
                placeholder="Enter notification title..."
                className="w-full h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
              <p className="text-xs text-[var(--text-muted)]">Maximum 100 characters</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="body" className="block text-sm font-medium text-[var(--text-strong)]">
                Notification Message
              </label>
              <textarea
                id="body"
                name="body"
                required
                maxLength={250}
                rows={4}
                placeholder="Enter notification message..."
                className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
              <p className="text-xs text-[var(--text-muted)]">Maximum 250 characters</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="actionUrl" className="block text-sm font-medium text-[var(--text-strong)]">
                Action URL (Optional)
              </label>
              <input
                type="url"
                id="actionUrl"
                name="actionUrl"
                placeholder="https://..."
                className="w-full h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
              />
              <p className="text-xs text-[var(--text-muted)]">URL to open when user taps the notification</p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Link
                href="/admin/notifications"
                className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Notification
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]/80 p-6">
          <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-3">Important Notes</h3>
          <ul className="space-y-2 text-sm text-[var(--text-muted)]">
            <li>• Notifications will be sent to all active users of the selected app (customers or drivers)</li>
            <li>• Users must have the app installed and FCM tokens registered to receive notifications</li>
            <li>• Notifications are sent immediately and cannot be recalled</li>
            <li>• Use promotional notifications responsibly and in accordance with privacy laws</li>
            <li>• Test notifications should be sent to a small group first before mass sending</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
