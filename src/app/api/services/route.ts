import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";
import { calculateDiscountedPrice } from "@/lib/pricing";
import { resolveAreaPricing } from "@/lib/area-resolver";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get GPS coordinates from query params for zone-based pricing
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const latitude = lat ? parseFloat(lat) : null;
    const longitude = lng ? parseFloat(lng) : null;
    
    console.log("[services][GET] Zone pricing request:", {
      lat,
      lng,
      parsedLat: latitude,
      parsedLng: longitude,
      hasValidCoords: latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude),
      fullUrl: request.url,
    });
    
    // If coordinates provided, log area resolution attempt
    if (latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      console.log("[services][GET] Will attempt zone pricing resolution for:", { latitude, longitude });
    } else {
      console.log("[services][GET] No valid coordinates - zone pricing will NOT be applied");
    }

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
          imageUrl: true,
          carTypes: true,
        },
      }),
      loadPricingAdjustmentConfig(),
    ]);

    // Apply zone-based pricing and adjustments
    const servicesWithAdjustedPricing = await Promise.all(
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

        const discountedPrice = calculateDiscountedPrice(basePriceCents, discountPercentage);

        const rawTaxPercentage = pricingAdjustments.taxPercentage;
        const normalizedTaxPercentage =
          rawTaxPercentage && Number.isFinite(rawTaxPercentage) && rawTaxPercentage > 0
            ? Math.min(Math.max(rawTaxPercentage, 0), 100)
            : 0;

        const rawStripePercentage = pricingAdjustments.stripeFeePercentage;
        const normalizedStripePercentage =
          rawStripePercentage && Number.isFinite(rawStripePercentage) && rawStripePercentage > 0
            ? Math.min(Math.max(rawStripePercentage, 0), 100)
            : 0;

        const baseVatCents = normalizedTaxPercentage > 0
          ? Math.round((basePriceCents * normalizedTaxPercentage) / 100)
          : 0;

        const discountedVatCents = normalizedTaxPercentage > 0
          ? Math.round((discountedPrice * normalizedTaxPercentage) / 100)
          : 0;

        const basePriceWithVat = basePriceCents + baseVatCents;
        const discountedPriceWithVat = discountedPrice + discountedVatCents;

        // Add Stripe fee on top of VAT-inclusive prices
        const baseStripeFeeCents = normalizedStripePercentage > 0
          ? Math.round((basePriceWithVat * normalizedStripePercentage) / 100)
          : 0;

        const discountedStripeFeeCents = normalizedStripePercentage > 0
          ? Math.round((discountedPriceWithVat * normalizedStripePercentage) / 100)
          : 0;

        const basePriceWithVatAndStripe = basePriceWithVat + baseStripeFeeCents;
        const finalPriceWithVatAndStripe = discountedPriceWithVat + discountedStripeFeeCents;

        return {
          ...service,
          priceCents: basePriceCents,
          discountPercentage,
          adjustedBasePriceCents: basePriceWithVatAndStripe,
          adjustedFinalPriceCents: finalPriceWithVatAndStripe,
          areaId,
          areaName,
        };
      })
    );

    return jsonResponse({ data: servicesWithAdjustedPricing });
  } catch (error) {
    console.error("[services][GET]", error);
    return errorResponse("Unable to load services", 500);
  }
}

export function OPTIONS() {
  return noContentResponse();
}
