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
    etaLabel: undefined as string | undefined,
    isInHouse: true as const,
  };

  const partnerItems = partners.map((partner) => ({
    id: partner.id,
    name: partner.name,
    // Placeholder logo for now; can be replaced with a real logo URL stored on Partner later
    logoUrl: "https://via.placeholder.com/200x200?text=" + encodeURIComponent(partner.name.slice(0, 10)),
    rating: 4.5,
    ratingCountLabel: "(10+)",
    priceLabel: "12 AED",
    status: "busy" as const,
    statusLabel: "BUSY" as const,
    etaLabel: undefined as string | undefined,
    isInHouse: false as const,
  }));

  const items = [quickwayProvider, ...partnerItems];

  return jsonResponse({ items });
}
