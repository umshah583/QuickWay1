"use client";

import { useState, useTransition } from "react";

export default function CouponForm({ bookingId, initialCode, disabled }: { bookingId: string; initialCode?: string | null; disabled?: boolean }) {
  const [codeInput, setCodeInput] = useState(initialCode ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function applyCoupon() {
    setMessage(null);
    setError(null);
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      setError("Enter a coupon code");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/bookings/apply-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, code }),
      });
      if (res.ok) {
        setMessage("Coupon applied");
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Unable to apply coupon");
      }
    });
  }

  async function removeCoupon() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/bookings/apply-coupon", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      if (res.ok) {
        setMessage("Coupon removed");
        setCodeInput("");
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Unable to remove coupon");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="Coupon code"
          disabled={disabled || isPending}
          className="w-full border rounded px-3 py-2 uppercase tracking-[0.2em]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={applyCoupon}
            disabled={disabled || isPending}
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={removeCoupon}
            disabled={disabled || isPending}
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] disabled:opacity-70"
          >
            Remove
          </button>
        </div>
      </div>
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
