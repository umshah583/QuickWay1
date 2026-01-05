import { Suspense } from "react";
import { PartnerAddDriverForm } from "../PartnerAddDriverForm";

export default function PartnerDriversPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">Partner</p>
        <h1 className="text-3xl font-semibold text-[var(--text-strong)]">New driver request</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Submit a driver for approval. Once an admin approves the request, the driver account will be provisioned and linked to your partner roster.
        </p>
      </header>
      <Suspense fallback={<div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 text-sm text-[var(--text-muted)]">Loading…</div>}>
        <PartnerAddDriverForm />
      </Suspense>
    </div>
  );
}
