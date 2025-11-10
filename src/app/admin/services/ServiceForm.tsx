"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";

type ServiceFormValues = {
  id?: string;
  name?: string;
  description?: string | null;
  durationMin?: number;
  priceCents?: number;
  active?: boolean;
};

type ServiceFormProps = {
  action: (formData: FormData) => Promise<void>;
  values?: ServiceFormValues;
  submitLabel: string;
  cancelHref: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function ServiceForm({ action, values, submitLabel, cancelHref }: ServiceFormProps) {
  const price = values?.priceCents ? (values.priceCents / 100).toFixed(2) : "";

  return (
    <form action={action} className="space-y-6">
      {values?.id && <input type="hidden" name="id" defaultValue={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={values?.name ?? ""}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Duration (minutes)</span>
          <input
            name="durationMin"
            type="number"
            min={1}
            required
            defaultValue={values?.durationMin ?? ""}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Description</span>
        <textarea
          name="description"
          defaultValue={values?.description ?? ""}
          rows={4}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm max-w-xs">
        <span className="font-medium text-[var(--text-strong)]">Price (AED)</span>
        <input
          name="price"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={price}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          name="active"
          type="checkbox"
          defaultChecked={values?.active ?? true}
          className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
        />
        <span className="text-[var(--text-strong)]">Service is active</span>
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} />
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
