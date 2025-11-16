import prisma from "@/lib/prisma";
import CouponForm from "../CouponForm";
import { createCoupon } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      priceCents: true,
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Create coupon</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Configure discount codes that can be shared with customers for limited-time promotions.
        </p>
      </header>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-sm">
        <CouponForm
          action={createCoupon}
          submitLabel="Create coupon"
          cancelHref="/admin/coupons"
          services={services}
        />
      </div>
    </div>
  );
}
