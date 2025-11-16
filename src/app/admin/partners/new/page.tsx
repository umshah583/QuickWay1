import NewPartnerForm from "../NewPartnerForm";
import { getDefaultCommissionPercentage } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPartnerPage() {
  const defaultCommission = await getDefaultCommissionPercentage();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Add partner</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Register a new fleet or franchise partner so you can assign drivers and track their earnings in the partner dashboard.
        </p>
      </header>

      <NewPartnerForm defaultCommissionPercentage={defaultCommission} />
    </div>
  );
}
