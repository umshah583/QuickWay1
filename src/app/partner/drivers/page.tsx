import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Users, Plus, Mail, Phone, UserCircle, CheckCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PartnerDriversPage({
  searchParams,
}: {
  searchParams: Promise<{ driverRequest?: string }>;
}) {
  const params = await searchParams;
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;

  const partner = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: { id: true, name: true },
  });

  if (!partner) {
    return (
      <div className="px-4 py-10">
        <p className="text-sm text-rose-600">Partner profile not found.</p>
      </div>
    );
  }

  const drivers = await prisma.user.findMany({
    where: {
      partnerId: partner.id,
      role: "DRIVER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const showSuccessBanner = params.driverRequest === "1";

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      {showSuccessBanner && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-700">Driver request submitted successfully!</p>
            <p className="text-xs text-green-600">The driver will be added to your roster once approved by admin.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Drivers</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage your drivers and submit new driver requests
          </p>
        </div>
        <Link
          href="/partner/drivers/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary)]/90"
        >
          <Plus className="h-4 w-4" />
          Add New Driver
        </Link>
      </div>

      {/* Stats */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
            <Users className="h-6 w-6 text-[var(--brand-primary)]" />
          </div>
          <div>
            <p className="text-3xl font-semibold text-[var(--text-strong)]">{drivers.length}</p>
            <p className="text-sm text-[var(--text-muted)]">Total Drivers</p>
          </div>
        </div>
      </div>

      {/* Drivers List */}
      {drivers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)] px-6 py-12 text-center">
          <Users className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
          <h3 className="mt-4 text-lg font-medium text-[var(--text-strong)]">No drivers yet</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Get started by adding your first driver
          </p>
          <Link
            href="/partner/drivers/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary)]/90"
          >
            <Plus className="h-4 w-4" />
            Add First Driver
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {drivers.map((driver) => {
                  return (
                    <tr key={driver.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
                            <UserCircle className="h-6 w-6 text-[var(--brand-primary)]" />
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-strong)]">{driver.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">ID: {driver.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-[var(--text-medium)]">
                            <Mail className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                            {driver.email}
                          </div>
                          {driver.phoneNumber && (
                            <div className="flex items-center gap-2 text-sm text-[var(--text-medium)]">
                              <Phone className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                              {driver.phoneNumber}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[var(--text-medium)]">
                          {new Date(driver.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/partner/drivers/${driver.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors"
                        >
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
