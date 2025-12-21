"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { updatePartner } from "../../actions";
import type { PartnerFormState } from "../../actions";
import DeletePartnerForm from "../../DeletePartnerForm";

type EditPartnerFormProps = {
  partner: {
    id: string;
    name: string;
    email: string | null;
    commissionPercentage: number | null;
    logoUrl: string | null;
    userId?: string | null;
  };
  defaultCommissionPercentage: number | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

function formatPercentageValue(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  const rounded = Number.parseFloat(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

export default function EditPartnerForm({ partner, defaultCommissionPercentage }: EditPartnerFormProps) {
  const initialState: PartnerFormState = {};
  const boundUpdate = updatePartner.bind(null, partner.id);
  const [state, formAction] = useActionState(boundUpdate, initialState);
  const [createCredentials, setCreateCredentials] = useState(false);

  const commissionDefaultValue = useMemo(
    () => formatPercentageValue(partner.commissionPercentage ?? defaultCommissionPercentage ?? null),
    [partner.commissionPercentage, defaultCommissionPercentage],
  );

  return (
    <div className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
      <form action={formAction} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Partner name</span>
            <input
              type="text"
              name="name"
              defaultValue={partner.name}
              required
              placeholder="Acme Fleet Services"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Partner image URL (optional)</span>
            <input
              type="url"
              name="logoUrl"
              defaultValue={partner.logoUrl ?? ""}
              placeholder="https://cdn.example.com/partner-logo.png"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
            <span className="text-xs text-[var(--text-muted)]">This logo appears in customer and partner apps.</span>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Contact email (optional)</span>
            <input
              type="email"
              name="email"
              required={createCredentials}
              defaultValue={partner.email ?? ""}
              placeholder="partner@example.com"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Commission (%)</span>
            <input
              type="number"
              name="commissionPercentage"
              min={0}
              max={100}
              step={0.1}
              defaultValue={commissionDefaultValue}
              placeholder={commissionDefaultValue || "e.g. 15"}
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
            <span className="text-xs text-[var(--text-muted)]">Leave blank to fall back to the platform default.</span>
          </label>
        </div>

        {partner.userId ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700">
            <p className="font-semibold">Partner login provisioned</p>
            <p className="mt-1 text-xs text-emerald-700/80">
              This partner already has credentials linked. Updating the email above will update their login email automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--surface-border)] bg-white/60 p-4 text-sm">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="createCredentials"
                value="on"
                checked={createCredentials}
                onChange={(event) => setCreateCredentials(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
              />
              <span>
                <span className="font-semibold text-[var(--text-strong)]">Create partner login credentials</span>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Generates a partner portal account using the email above so the partner can sign in and view their dashboard.
                </p>
              </span>
            </label>

            {createCredentials ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-[var(--text-strong)]">Temporary password</span>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </label>
                <p className="text-xs text-[var(--text-muted)]">
                  Share the password with the partner. They can update it later from the account settings.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {state?.error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{state.error}</p>
        ) : null}

        <div className="flex items-center gap-3">
          <SubmitButton />
          <span className="text-xs text-[var(--text-muted)]">Changes apply immediately for partner dashboards.</span>
        </div>
      </form>

      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm">
        <h2 className="text-sm font-semibold text-rose-600">Danger zone</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Removing a partner will unlink their drivers and bookings. You can reassign drivers to a different partner afterward.
        </p>
        <DeletePartnerForm partnerId={partner.id} partnerName={partner.name} className="mt-6" />
      </div>
    </div>
  );
}
