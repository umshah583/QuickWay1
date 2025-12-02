import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";
import { calculateDiscountedPrice } from "@/lib/pricing";

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
          imageUrl: true,
          carTypes: true,
        },
      }),
      loadPricingAdjustmentConfig(),
    ]);

    const servicesWithAdjustedPricing = services.map(service => {
      const discountedPrice = calculateDiscountedPrice(service.priceCents, service.discountPercentage);

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
        ? Math.round((service.priceCents * normalizedTaxPercentage) / 100)
        : 0;

      const discountedVatCents = normalizedTaxPercentage > 0
        ? Math.round((discountedPrice * normalizedTaxPercentage) / 100)
        : 0;

      const basePriceWithVat = service.priceCents + baseVatCents;
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
        adjustedBasePriceCents: basePriceWithVatAndStripe,
        adjustedFinalPriceCents: finalPriceWithVatAndStripe,
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
