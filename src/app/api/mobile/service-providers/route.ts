import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { jsonResponse, errorResponse, noContentResponse } from "@/lib/api-response";
import { PartnerServiceRequestStatus } from "@prisma/client";

export async function OPTIONS() {
  return noContentResponse("GET,OPTIONS");
}

export async function GET(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const serviceTypeId = url.searchParams.get("serviceTypeId");

  let includeQuickwayProvider = true;
  let eligiblePartnerIds: string[] | null = null;

  if (serviceTypeId) {
    // Fetch in-house services for this service type (no partner requests)
    const inHouseServices = await prisma.service.findMany({
      where: {
        active: true,
        partnerServiceRequests: {
          none: {},
        },
      },
    });
    const quickwayServiceCount = inHouseServices.filter(
      (s) => (s as { serviceTypeId?: string | null }).serviceTypeId === serviceTypeId
    ).length;

    // Fetch approved partner requests and filter by service type
    const allApprovedRequests = await prisma.partnerServiceRequest.findMany({
      where: {
        status: PartnerServiceRequestStatus.APPROVED,
      },
      include: {
        service: true,
      },
    });
    const approvedPartnerRequests = allApprovedRequests.filter(
      (req) => (req.service as { serviceTypeId?: string | null } | null)?.serviceTypeId === serviceTypeId
    );

    includeQuickwayProvider = quickwayServiceCount > 0;
    eligiblePartnerIds = Array.from(
      new Set(
        approvedPartnerRequests
          .map(req => req.partnerId)
          .filter((partnerId): partnerId is string => Boolean(partnerId)),
      ),
    );
  }

  // If serviceTypeId filter is active and no partners have matching services, return empty partners array
  const partners = eligiblePartnerIds && eligiblePartnerIds.length === 0
    ? []
    : await prisma.partner.findMany({
        where: eligiblePartnerIds && eligiblePartnerIds.length > 0
          ? { id: { in: eligiblePartnerIds } }
          : undefined,
        select: {
          id: true,
          name: true,
          createdAt: true,
          logoUrl: true,
          account: {
            select: {
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

  const quickwayProvider = {
    id: "quickway-inhouse",
    name: "QuickWay (in-house)",
    logoUrl: "https://via.placeholder.com/200x200?text=" + encodeURIComponent("QuickWay"),
    rating: 4.8,
    ratingCountLabel: "(100+)",
    priceLabel: "Standard rates",
    status: "available" as const,
    statusLabel: "AVAILABLE" as const,
    etaLabel: "15-25 min" as string | undefined,
    isInHouse: true as const,
  };

  const partnerItems = partners.map((partner, index) => {
    const baseMinutes = 20 + index * 5;
    const etaMin = baseMinutes;
    const etaMax = baseMinutes + 10;
    const etaLabel = `${etaMin}-${etaMax} min`;

    const logoUrl =
      partner.logoUrl ||
      partner.account?.image ||
      "https://via.placeholder.com/200x200?text=" + encodeURIComponent(partner.name.slice(0, 10) || "Partner");

    return {
      id: partner.id,
      name: partner.name,
      logoUrl,
      rating: 4.5,
      ratingCountLabel: "(10+)",
      priceLabel: "12 AED",
      status: "busy" as const,
      statusLabel: "BUSY" as const,
      etaLabel,
      isInHouse: false as const,
    };
  });

  const items = [
    ...(includeQuickwayProvider ? [quickwayProvider] : []),
    ...partnerItems,
  ];

  return jsonResponse({ items });
}

