"use client";

import { useState } from "react";

type DeleteCouponButtonProps = {
  id: string;
  code: string;
  action: (formData: FormData) => Promise<void>;
  redirectTo?: string;
};

export default function DeleteCouponButton({ id, code, action, redirectTo }: DeleteCouponButtonProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-400 hover:text-red-700"
      >
        Delete
      </button>

      {confirming ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-red-700">Delete coupon “{code}”?</h2>
            <p className="mt-2 text-sm text-red-600">
              This will permanently remove the coupon and any future bookings will no longer accept it. Existing bookings will retain their applied discounts.
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
                <input type="hidden" name="id" value={id} />
                {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
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
      ) : null}
    </div>
  );
}
