import Link from "next/link";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { toggleCouponActive, deleteCoupon } from "./actions";
import DeleteCouponButton from "./DeleteCouponButton";

type CouponRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: "PERCENTAGE" | "AMOUNT";
  discountValue: number;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number | null;
  minBookingAmountCents: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
  appliesToAllServices: boolean;
  applicableServiceIds: string[];
  createdAt: Date;
  _count: { redemptions: number };
  redemptions: { amountCents: number }[];
};

type ServiceRecord = { id: string; name: string };

export const dynamic = "force-dynamic";

function formatDiscount(coupon: { discountType: "PERCENTAGE" | "AMOUNT"; discountValue: number }) {
  if (coupon.discountType === "PERCENTAGE") {
    return `${coupon.discountValue}% off`;
  }
  return `AED ${(coupon.discountValue / 100).toFixed(2)} off`;
}

function formatValidity(validFrom: Date | null, validUntil: Date | null) {
  if (!validFrom && !validUntil) return "No expiry";
  if (validFrom && validUntil) {
    return `${format(validFrom, "MMM d, yyyy")} → ${format(validUntil, "MMM d, yyyy")}`;
  }
  if (validFrom) {
    return `Starts ${format(validFrom, "MMM d, yyyy")}`;
  }
  return `Expires ${format(validUntil!, "MMM d, yyyy")}`;
}

export default async function AdminCouponsPage() {
  const [coupons, services] = (await Promise.all([
    (prisma as unknown as { coupon: { findMany: (args: unknown) => Promise<CouponRecord[]> } }).coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { redemptions: true } },
        redemptions: { select: { amountCents: true } },
      },
    }),
    prisma.service.findMany({ select: { id: true, name: true } }),
  ])) as [CouponRecord[], ServiceRecord[]];

  const serviceLookup = new Map<string, string>(services.map((service) => [service.id, service.name]));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Coupons</h1>
          <p className="text-sm text-[var(--text-muted)]">Create promotional codes and monitor redemption performance.</p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-secondary)]"
        >
          Create coupon
        </Link>
      </header>

      {coupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">No coupons yet. Create your first coupon to start offering promotions.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm">
          <table className="min-w-full divide-y divide-[var(--surface-border)] text-sm">
            <thead className="bg-[var(--background)]/60">
              <tr className="text-left text-[var(--text-muted)]">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="px-4 py-3 font-semibold">Usage</th>
                <th className="px-4 py-3 font-semibold">Savings</th>
                <th className="px-4 py-3 font-semibold">Valid</th>
                <th className="px-4 py-3 font-semibold">Scope</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {coupons.map((coupon) => {
                const totalSavingsCents = coupon.redemptions.reduce<number>((sum, redemption) => sum + redemption.amountCents, 0);
                const scopeLabel = coupon.appliesToAllServices
                  ? "All services"
                  : coupon.applicableServiceIds
                      .map((serviceId: string) => serviceLookup.get(serviceId) ?? "Service")
                      .slice(0, 3)
                      .join(", ") + (coupon.applicableServiceIds.length > 3 ? "…" : "");

                return (
                  <tr key={coupon.id} className="hover:bg-[var(--brand-accent)]/15 transition">
                    <td className="px-4 py-3 font-semibold text-[var(--text-strong)]">
                      <Link href={`/admin/coupons/${coupon.id}`} className="hover:text-[var(--brand-primary)]">
                        {coupon.code}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{coupon.name}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{formatDiscount(coupon)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {coupon._count.redemptions} uses
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">AED {(totalSavingsCents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-slate-600">
                        {formatValidity(coupon.validFrom, coupon.validUntil)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {coupon.active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Active</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">Inactive</span>
                      )}
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{scopeLabel}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <form action={toggleCouponActive}>
                          <input type="hidden" name="id" value={coupon.id} />
                          <input type="hidden" name="active" value={coupon.active ? "true" : "false"} />
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                          >
                            {coupon.active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                        <Link
                          href={`/admin/coupons/${coupon.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-3 py-1.5 font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                        >
                          Edit
                        </Link>
                        <DeleteCouponButton id={coupon.id} code={coupon.code} action={deleteCoupon} redirectTo="/admin/coupons" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
