"use client";

import { useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function PushNotificationPrompt() {
  const { supported, subscribed, permission, requestPermission } = usePushNotifications();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supported) {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    setError(null);
    try {
      const success = await requestPermission();
      if (!success) {
        setError("We could not enable notifications. Please check your browser settings and try again.");
      }
    } catch (err) {
      console.error("Failed to enable notifications", err);
      setError("Something went wrong while enabling notifications.");
    } finally {
      setLoading(false);
    }
  };

  if (subscribed && permission === "granted") {
    return (
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]/60 p-4 text-sm text-[var(--text-muted)]">
        <p className="font-medium text-[var(--text-strong)]">Notifications enabled</p>
        <p>We will notify you when booking statuses change.</p>
      </div>
    );
  }

  const isDenied = permission === "denied";

  return (
    <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/40 p-4 text-sm">
      <p className="font-medium text-[var(--text-strong)]">Stay updated</p>
      <p className="mt-1 text-[var(--text-muted)]">Enable browser notifications to get alerts when your booking status changes.</p>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {isDenied ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Notifications are blocked in your browser. Update your site permissions to allow notifications, then refresh this page.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="mt-3 inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          {loading ? "Enabling..." : "Enable notifications"}
        </button>
      )}
    </div>
  );
}
