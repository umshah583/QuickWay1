"use client";

import { useState } from "react";

export default function PayButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCongrats, setShowCongrats] = useState(false);

  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Unable to start checkout. Configure Stripe env vars.");
      } else if (data?.free) {
        setShowCongrats(true);
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } else if (data?.url) {
        window.location.href = data.url as string;
      } else {
        setError("Unexpected response from checkout");
      }
    } catch {
      setError("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={onClick}
        className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Processing..." : "Pay now"}
      </button>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {showCongrats ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
              🎉
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Congrats!</h2>
            <p className="mt-2 text-sm text-gray-600">This wash is on us—your next booking just unlocked a free service.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
