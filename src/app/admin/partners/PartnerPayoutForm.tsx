"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createPartnerPayout, type PartnerPayoutFormState } from "./actions";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Processing..." : "Record payout"}
    </button>
  );
}

export default function PartnerPayoutForm({
  partnerId,
  outstandingCents,
}: {
  partnerId: string;
  outstandingCents: number;
}) {
  const initialState: PartnerPayoutFormState = {};
  const boundAction = createPartnerPayout.bind(null, partnerId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state?.success, router]);

  const outstandingLabel = (outstandingCents / 100).toFixed(2);
  const disableForm = outstandingCents <= 0;

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <div className="grid gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Payout amount (AED)</span>
          <input
            type="number"
            name="amount"
            min={0}
            step="0.01"
            defaultValue={outstandingLabel}
            placeholder="0.00"
            disabled={disableForm}
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none disabled:opacity-60"
          />
          <span className="text-xs text-[var(--text-muted)]">
            Outstanding balance: <strong className="text-[var(--text-strong)]">AED {outstandingLabel}</strong>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Internal note (optional)</span>
          <textarea
            name="note"
            rows={3}
            placeholder="Add reference ID or bank transfer notes"
            disabled={disableForm}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none disabled:opacity-60"
          />
        </label>
      </div>

      {state?.error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          Payout recorded successfully.
        </p>
      ) : null}

      <div className="flex items-center justify-end">
        <SubmitButton disabled={disableForm} />
      </div>
    </form>
  );
}
