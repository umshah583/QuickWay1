"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";
import { PARTNER_SERVICE_CAR_TYPES } from "@/app/partner/services/carTypes";

type ServiceFormValues = {
  id?: string;
  name?: string;
  description?: string | null;
  durationMin?: number;
  priceCents?: number;
  active?: boolean;
  discountPercentage?: number;
  imageUrl?: string | null;
  carTypes?: string[];
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
  const discount =
    typeof values?.discountPercentage === "number" ? values.discountPercentage.toString() : "";

  // Pre-select only the car types that are actually saved for this service.
  // For new or legacy services without carTypes yet, everything starts unchecked
  // and the admin explicitly chooses the supported vehicle types.
  const selectedCarTypes = values?.carTypes ?? [];

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

      <label className="flex flex-col gap-2 text-sm max-w-xl">
        <span className="font-medium text-[var(--text-strong)]">Image URL</span>
        <input
          name="imageUrl"
          type="url"
          placeholder="https://example.com/image.jpg"
          defaultValue={values?.imageUrl ?? ""}
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

      <fieldset className="max-w-xl space-y-2">
        <legend className="text-sm font-medium text-[var(--text-strong)]">Available car types</legend>
        <p className="text-xs text-[var(--text-muted)]">
          Select which vehicle types this service can be used for. Leave all unchecked to allow all car types.
        </p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {PARTNER_SERVICE_CAR_TYPES.map((type) => (
            <label key={type} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="carTypes"
                value={type}
                defaultChecked={selectedCarTypes.includes(type)}
                className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
              />
              <span className="text-[var(--text-strong)]">{type}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--text-strong)]">Description</span>
        <textarea
          name="description"
          defaultValue={values?.description ?? ""}
          rows={4}
          className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <label className="flex flex-col gap-2 text-sm">
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
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--text-strong)]">Discount (%)</span>
          <input
            name="discountPercentage"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={discount}
            className="rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
      </div>

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
