import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import CouponForm from "../CouponForm";
import { updateCoupon } from "../actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditCouponPage({ params }: { params: Params }) {
  const { id } = await params;

  const [coupon, services] = await Promise.all([
    (prisma as unknown as { coupon: { findUnique: (args: unknown) => Promise<null | {
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
      updatedAt: Date;
    }> } }).coupon.findUnique({ where: { id } }),
    prisma.service.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, priceCents: true },
    }),
  ]);

  if (!coupon) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Edit coupon</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Update coupon availability, discount settings, or scope. Changes apply to future bookings only.
        </p>
      </header>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm">
        <CouponForm
          action={updateCoupon}
          submitLabel="Save changes"
          cancelHref="/admin/coupons"
          services={services}
          disableCode
          values={{
            id: coupon.id,
            code: coupon.code,
            name: coupon.name,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxRedemptions: coupon.maxRedemptions,
            maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
            minBookingAmountCents: coupon.minBookingAmountCents,
            validFrom: coupon.validFrom,
            validUntil: coupon.validUntil,
            active: coupon.active,
            appliesToAllServices: coupon.appliesToAllServices,
            applicableServiceIds: coupon.applicableServiceIds,
          }}
        />
      </div>
    </div>
  );
}
