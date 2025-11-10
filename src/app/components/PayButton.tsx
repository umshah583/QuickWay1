"use client";

import { useState } from "react";

export default function PayButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok || !data?.url) {
        setError(data?.error ?? "Unable to start checkout. Configure Stripe env vars.");
      } else {
        window.location.href = data.url as string;
      }
    } catch {
      setError("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={onClick} disabled={loading} className="rounded bg-black text-white px-4 py-2">
        {loading ? "Redirecting..." : "Pay now"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
