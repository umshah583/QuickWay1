"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createDriver } from "../actions";
import type { CreateDriverState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-secondary)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Adding driver..." : "Create driver"}
    </button>
  );
}

const initialState: CreateDriverState = {};

export default function NewDriverPage() {
  const [state, formAction] = useActionState(createDriver, initialState);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Add driver</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Create a driver account so the team can assign bookings and track performance in real-time.
        </p>
      </header>

      <form action={formAction} className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Full name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Driver name"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--text-strong)]">Email</span>
            <input
              type="email"
              name="email"
              required
              placeholder="driver@example.com"
              className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-sm sm:w-80">
          <span className="font-medium text-[var(--text-strong)]">Temporary password</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            placeholder="Minimum 6 characters"
            className="h-11 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none"
          />
        </label>
        {state?.error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{state.error}</p>
        ) : null}
        <div className="flex items-center gap-3">
          <SubmitButton />
          <Link
            href="/admin/drivers"
            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
          >
            Cancel
          </Link>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Drivers receive their account credentials via the email you provide. Send them a password reset link after first login for security.
        </p>
      </form>
    </div>
  );
}
