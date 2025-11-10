import ServiceForm from "../ServiceForm";
import { createService } from "../actions";

export const dynamic = "force-dynamic";

export default function NewServicePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Add service</h1>
        <p className="text-sm text-[var(--text-muted)]">Define a new package with pricing, duration, and availability.</p>
      </header>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm">
        <ServiceForm action={createService} submitLabel="Create service" cancelHref="/admin/services" />
      </div>
    </div>
  );
}
