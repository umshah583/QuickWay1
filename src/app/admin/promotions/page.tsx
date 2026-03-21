import { prisma } from "@/lib/prisma";
import { PromotionsManagementClient } from "./PromotionsManagementClient";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  // Fetch all coupons
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Fetch coupon usage stats
  const couponUsage = await prisma.booking.groupBy({
    by: ["couponId"],
    where: {
      couponId: { not: null },
    },
    _count: {
      id: true,
    },
  });

  // Create usage map
  const usageMap = couponUsage.reduce((acc, usage) => {
    if (usage.couponId) {
      acc[usage.couponId] = usage._count.id;
    }
    return acc;
  }, {} as Record<string, number>);

  // Calculate total stats
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter(c => c.active).length;
  const totalUsage = Object.values(usageMap).reduce((sum, count) => sum + count, 0);

  return (
    <PromotionsManagementClient
      coupons={coupons as any}
      usageMap={usageMap}
      totalCoupons={totalCoupons}
      activeCoupons={activeCoupons}
      totalUsage={totalUsage}
    />
  );
}
