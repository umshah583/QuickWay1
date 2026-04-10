"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type DeleteServiceButtonProps = {
  id: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
  redirectTo?: string;
  fieldName?: string;
  description?: string;
};

export default function DeleteServiceButton({
  id,
  name,
  action,
  redirectTo,
  fieldName = "id",
  description = "This action will permanently remove this item and cannot be undone."
}: DeleteServiceButtonProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center rounded-full border border-red-200 px-3 py-1.5 font-semibold text-red-600 transition hover:border-red-400 hover:text-red-700"
      >
        Delete
      </button>

      {confirming &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-[var(--text-strong)]">Delete "{name}"?</h3>
              <p className="mt-2 text-sm text-[var(--text-medium)]">{description}</p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-medium)] hover:bg-[var(--surface-secondary)]"
                >
                  Cancel
                </button>
                <form action={action} className="inline-flex">
                  <input type="hidden" name={fieldName} value={id} />
                  {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Confirm delete
                  </button>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
