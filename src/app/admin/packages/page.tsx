import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Package, Plus, Edit, Star } from "lucide-react";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

type MonthlyPackageWithCounts = {
  id: string;
  name: string;
  description: string | null;
  duration: string;
  washesPerMonth: number;
  priceCents: number;
  discountPercent: number | null;
  popular: boolean;
  status: string;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
  _count: {
    subscriptions: number;
  };
};

export default async function PackagesPage() {
  type PrismaWithPackages = typeof prisma & {
    monthlyPackage: {
      findMany: (args: unknown) => Promise<MonthlyPackageWithCounts[]>;
    };
  };
  
  const packagesDb = prisma as PrismaWithPackages;
  const packages = await packagesDb.monthlyPackage.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
  });

  const activePackages = packages.filter((pkg) => pkg.status === "ACTIVE").length;
  const totalSubscriptions = packages.reduce((sum, pkg) => sum + pkg._count.subscriptions, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Monthly Packages</h1>
          <p className="text-sm text-[var(--text-muted)]">Create and manage subscription packages for customers</p>
        </div>
        <Link
          href="/admin/packages/new"
          className="flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create Package
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Total Packages</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{packages.length}</p>
            </div>
            <div className="rounded-lg bg-[var(--primary-gradient)] p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Active Packages</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activePackages}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 p-3">
              <Star className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Total Subscriptions</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{totalSubscriptions}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 p-3">
              <Package className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Packages List */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="border-b border-[var(--card-border)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">All Packages</h2>
        </div>

        {packages.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-50" />
            <p className="mt-4 text-sm text-[var(--text-muted)]">No packages yet. Create your first package to get started.</p>
            <Link
              href="/admin/packages/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Create Package
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--card-border)] bg-[var(--surface-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                    Package
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                    Washes/Month
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                    Subscribers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-[var(--text-medium)] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {packages.map((pkg: MonthlyPackageWithCounts) => (
                  <tr key={pkg.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {pkg.popular && <Star className="h-4 w-4 fill-amber-500 text-amber-500" />}
                        <div>
                          <div className="font-medium text-[var(--text-strong)]">{pkg.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">{pkg.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-[var(--surface-secondary)] px-2 py-1 text-xs font-medium text-[var(--text-medium)]">
                        {pkg.duration}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-[var(--text-strong)]">{pkg.washesPerMonth}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-strong)]">{formatCurrency(pkg.priceCents)}</div>
                        {pkg.discountPercent && pkg.discountPercent > 0 && (
                          <div className="text-xs text-[var(--success)]">{pkg.discountPercent}% off</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-[var(--text-medium)]">{pkg._count.subscriptions}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          pkg.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : pkg.status === "INACTIVE"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {pkg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/packages/${pkg.id}`}
                          className="rounded-lg p-2 text-[var(--text-medium)] hover:bg-[var(--hover-bg)] hover:text-[var(--brand-primary)] transition-colors"
                          title="Edit package"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
