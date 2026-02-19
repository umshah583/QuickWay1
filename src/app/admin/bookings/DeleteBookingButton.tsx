"use client";

import { useState } from "react";

type DeleteBookingButtonProps = {
  bookingId: string;
  bookingLabel?: string;
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
};

export default function DeleteBookingButton({
  bookingId,
  bookingLabel = "booking",
  action,
  disabled = false,
  disabledReason,
}: DeleteBookingButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (disabled) {
    return (
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] opacity-60"
        title={disabledReason}
        disabled
      >
        Delete
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-400 hover:text-red-700"
      >
        Delete
      </button>

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-red-700">Delete this booking?</h2>
            <p className="mt-2 text-sm text-red-600">
              This will permanently remove the {bookingLabel}. Customers and drivers will no longer see it.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              >
                Cancel
              </button>
              <form action={action} className="inline-flex">
                <input type="hidden" name="bookingId" value={bookingId} />
                <button
                  type="submit"
                  className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  Confirm delete
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
