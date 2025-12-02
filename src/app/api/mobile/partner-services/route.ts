import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { jsonResponse, errorResponse, noContentResponse } from "@/lib/api-response";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";
import { calculateDiscountedPrice } from "@/lib/pricing";

export async function OPTIONS() {
  return noContentResponse("GET,OPTIONS");
}

export async function GET(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const partnerId = url.searchParams.get("partnerId");
  const carType = url.searchParams.get("carType");

  if (!partnerId) {
    return errorResponse("Missing partnerId", 400);
  }

  // Special case: QuickWay in-house provider uses base services list
  if (partnerId === "quickway-inhouse") {
    // Note: Service model doesn't have a carType field (only PartnerServiceRequest has it).
    // QuickWay in-house services are available for all car types.
    // The carType parameter is used only for grouping in the response, not filtering.
    
    // Fetch all services (including relations) and filter out those linked to partners
    const allServices = await prisma.service.findMany({
      where: {
        active: true,
      },
      orderBy: { priceCents: "asc" },
      include: {
        partnerServiceRequests: true,
      },
    });

    // Filter to only services that have NO partner service requests
    type ServiceWithRequests = typeof allServices[number];
    let inHouseServices = allServices.filter((service: ServiceWithRequests) =>
      (service.partnerServiceRequests?.length ?? 0) === 0,
    );

    // If a carType is specified, restrict QuickWay services to those that
    // explicitly include that car type in their carTypes array.
    if (carType) {
      inHouseServices = inHouseServices.filter((service) => {
        const types = (service.carTypes ?? []) as string[];
        return types.includes(carType);
      });
    }

    const [pricingAdjustments] = await Promise.all([
      loadPricingAdjustmentConfig(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const services = inHouseServices.map(({ partnerServiceRequests, ...service }) => service);

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

    const items = services.map((service) => {
      const discountedPrice = calculateDiscountedPrice(service.priceCents, service.discountPercentage);

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
        id: service.id,
        serviceId: service.id,
        partnerId: "quickway-inhouse",
        name: service.name,
        description: service.description,
        imageUrl: service.imageUrl ?? null,
        durationMin: service.durationMin,
        priceCents: finalPriceWithVatAndStripe,
        priceLabel: `AED ${(finalPriceWithVatAndStripe ?? 0) / 100}`,
        discountPercentage: service.discountPercentage ?? null,
        adjustedBasePriceCents: basePriceWithVatAndStripe,
        adjustedFinalPriceCents: finalPriceWithVatAndStripe,
        carType: carType ?? "Any",
      };
    });

    return jsonResponse({ items });
  }

  const where: { partnerId: string; status: "APPROVED" } = {
    partnerId,
    status: "APPROVED",
  };

  const [requests, pricingAdjustments] = await Promise.all([
    prisma.partnerServiceRequest.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        partnerId: true,
        serviceId: true,
        name: true,
        description: true,
        imageUrl: true,
        durationMin: true,
        priceCents: true,
        carType: true,
        service: {
          select: {
            name: true,
            description: true,
            imageUrl: true,
            durationMin: true,
            priceCents: true,
            discountPercentage: true,
            carTypes: true,
          },
        },
      },
    }),
    loadPricingAdjustmentConfig(),
  ]);

  const filteredRequests = requests.filter((request) => {
    if (!carType) return true;

    const serviceCarTypes = (request.service?.carTypes ?? []) as string[];

    if (serviceCarTypes.length > 0) {
      return serviceCarTypes.includes(carType);
    }

    // Fallback for legacy/older requests that don't have carTypes on Service yet
    return request.carType === carType;
  });

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

  const items = filteredRequests.map((request) => {
    // Use the linked Service fields so admin updates are reflected even for partners.
    const baseName = request.service?.name ?? request.name;
    const baseDescription = request.service?.description ?? request.description;
    const baseImageUrl = request.service?.imageUrl ?? request.imageUrl;
    const baseDurationMin = request.service?.durationMin ?? request.durationMin;
    const basePriceCents = request.service?.priceCents ?? request.priceCents;
    const discountPercentage = request.service?.discountPercentage ?? null;

    const discounted = calculateDiscountedPrice(basePriceCents, discountPercentage);

    const baseVatCents = normalizedTaxPercentage > 0
      ? Math.round((basePriceCents * normalizedTaxPercentage) / 100)
      : 0;

    const discountedVatCents = normalizedTaxPercentage > 0
      ? Math.round((discounted * normalizedTaxPercentage) / 100)
      : 0;

    const basePriceWithVat = basePriceCents + baseVatCents;
    const discountedPriceWithVat = discounted + discountedVatCents;

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
      id: request.id,
      partnerId: request.partnerId,
      serviceId: request.serviceId,
      name: baseName,
      description: baseDescription,
      imageUrl: baseImageUrl,
      durationMin: baseDurationMin,
      priceCents: finalPriceWithVatAndStripe,
      priceLabel: `AED ${(finalPriceWithVatAndStripe ?? 0) / 100}`,
      discountPercentage,
      adjustedBasePriceCents: basePriceWithVatAndStripe,
      adjustedFinalPriceCents: finalPriceWithVatAndStripe,
      carType: carType ?? request.carType,
    };
  });

  return jsonResponse({ items });
}
