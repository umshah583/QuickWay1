import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";
import { applyFeesToPrice, calculateDiscountedPrice } from "@/lib/pricing";

export async function GET() {
  try {
    const [services, pricingAdjustments] = await Promise.all([
      prisma.service.findMany({
        where: { active: true },
        orderBy: { priceCents: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          durationMin: true,
          priceCents: true,
          discountPercentage: true,
        },
      }),
      loadPricingAdjustmentConfig(),
    ]);

    const servicesWithAdjustedPricing = services.map(service => {
      const discountedPrice = calculateDiscountedPrice(service.priceCents, service.discountPercentage);
      const finalPriceWithFees = applyFeesToPrice(discountedPrice, pricingAdjustments);
      
      return {
        ...service,
        priceCents: finalPriceWithFees,
      };
    });

    return jsonResponse({ data: servicesWithAdjustedPricing });
  } catch (error) {
    console.error("[services][GET]", error);
    return errorResponse("Unable to load services", 500);
  }
}

export function OPTIONS() {
  return noContentResponse();
}
