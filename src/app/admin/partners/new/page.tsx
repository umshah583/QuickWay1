"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createPartner } from "../actions";
import type { PartnerFormState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Adding partner..." : "Create partner"}
    </button>
  );
}

const initialState: PartnerFormState = {};

export default function NewPartnerPage() {
  const [state, formAction] = useActionState(createPartner, initialState);
  const [createCredentials, setCreateCredentials] = useState(false);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Add partner</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Register a new fleet or franchise partner so you can assign drivers and track their earnings in the partner dashboard.
        </p>
      </header>

      <form action={formAction} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Partner name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Acme Fleet Services"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Contact email (optional)</span>
            <input
              type="email"
              name="email"
              required={createCredentials}
              placeholder="partner@example.com"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
        </div>

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

        {state?.error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{state.error}</p>
        ) : null}

        <div className="flex items-center gap-3">
          <SubmitButton />
          <Link
            href="/admin/partners"
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            Cancel
          </Link>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          Partners will see their assigned drivers and earnings in the partner portal once their account is provisioned.
        </p>
      </form>
    </div>
  );
}
