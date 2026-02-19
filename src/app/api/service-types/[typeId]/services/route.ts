import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";
import { applyFeesToPrice, calculateDiscountedPrice } from "@/lib/pricing";
import { resolveAreaPricing } from "@/lib/area-resolver";

type RouteParams = {
  params: Promise<{ typeId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { typeId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get GPS coordinates from query params
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const latitude = lat ? parseFloat(lat) : null;
    const longitude = lng ? parseFloat(lng) : null;

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

    // Apply pricing adjustments and zone-based pricing
    const servicesWithPricing = await Promise.all(
      services.map(async (service) => {
        let basePriceCents = service.priceCents;
        let discountPercentage = service.discountPercentage;
        let areaId: string | null = null;
        let areaName: string | null = null;

        // Check for zone-specific pricing if coordinates provided
        if (latitude !== null && longitude !== null && 
            Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const areaPricing = await resolveAreaPricing(
            service.id,
            latitude,
            longitude,
            service.priceCents,
            service.discountPercentage
          );

          if (areaPricing) {
            basePriceCents = areaPricing.priceCents;
            discountPercentage = areaPricing.discountPercentage;
            areaId = areaPricing.areaId;
            areaName = areaPricing.areaName;
          }
        }

        const discountedPrice = calculateDiscountedPrice(
          basePriceCents,
          discountPercentage
        );
        const adjustedBasePriceCents = applyFeesToPrice(
          basePriceCents,
          pricingAdjustments
        );
        const adjustedFinalPriceCents = applyFeesToPrice(
          discountedPrice,
          pricingAdjustments
        );

        return {
          ...service,
          priceCents: basePriceCents,
          discountPercentage,
          adjustedBasePriceCents,
          adjustedFinalPriceCents,
          areaId,
          areaName,
        };
      })
    );

    return NextResponse.json({ data: servicesWithPricing });
  } catch (error) {
    console.error("[GET /api/service-types/[typeId]/services] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
