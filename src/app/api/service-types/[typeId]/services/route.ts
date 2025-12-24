import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";
import { applyFeesToPrice, calculateDiscountedPrice } from "@/lib/pricing";

type RouteParams = {
  params: Promise<{ typeId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { typeId } = await params;

    const [services, pricingAdjustments] = await Promise.all([
      prisma.service.findMany({
        where: {
          active: true,
          serviceTypeId: typeId,
        },
        orderBy: { priceCents: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          durationMin: true,
          priceCents: true,
          discountPercentage: true,
          imageUrl: true,
          carTypes: true,
          attributeValues: true,
        },
      }),
      loadPricingAdjustmentConfig(),
    ]);

    // Apply pricing adjustments
    const servicesWithPricing = services.map((service) => {
      const discountedPrice = calculateDiscountedPrice(
        service.priceCents,
        service.discountPercentage
      );
      const adjustedBasePriceCents = applyFeesToPrice(
        service.priceCents,
        pricingAdjustments
      );
      const adjustedFinalPriceCents = applyFeesToPrice(
        discountedPrice,
        pricingAdjustments
      );

      return {
        ...service,
        adjustedBasePriceCents,
        adjustedFinalPriceCents,
      };
    });

    return NextResponse.json({ data: servicesWithPricing });
  } catch (error) {
    console.error("[GET /api/service-types/[typeId]/services] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
