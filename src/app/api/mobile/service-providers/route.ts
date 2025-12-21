import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { jsonResponse, errorResponse, noContentResponse } from "@/lib/api-response";

export async function OPTIONS() {
  return noContentResponse("GET,OPTIONS");
}

export async function GET(req: Request) {
  const user = await getMobileUserFromRequest(req);
  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const partners = await prisma.partner.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
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
    // Simple placeholder ETA window for in-house team
    etaLabel: "15-25 min" as string | undefined,
    isInHouse: true as const,
  };

  const partnerItems = partners.map((partner, index) => {
    // Stagger ETA windows slightly per partner as a placeholder
    const baseMinutes = 20 + index * 5;
    const etaMin = baseMinutes;
    const etaMax = baseMinutes + 10;
    const etaLabel = `${etaMin}-${etaMax} min`;

    const logoUrl =
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

  const items = [quickwayProvider, ...partnerItems];

  return jsonResponse({ items });
}

