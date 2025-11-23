import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PartnerSettingsPage() {
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;

  const partner = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: {
      name: true,
      email: true,
      commissionPercentage: true,
      createdAt: true,
    },
  });

  if (!partner) {
    return (
      <div className="px-4 py-10">
        <p className="text-sm text-rose-600">Partner profile not found.</p>
      </div>
    );
  }

  const commissionLabel =
    partner.commissionPercentage != null ? `${partner.commissionPercentage.toFixed(0)}%` : "Default";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage your partner profile and account preferences.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">Partner name</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{partner.name}</p>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">Email</p>
          <p className="mt-2 text-sm text-[var(--text-strong)]">{partner.email ?? "Not set"}</p>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">Commission</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{commissionLabel}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
        <p>Additional partner-specific settings can be configured here in the future.</p>
      </div>
    </div>
  );
}
