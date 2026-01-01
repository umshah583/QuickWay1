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

  try {
    const serviceTypes = await prisma.serviceType.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        color: true,
        attributes: true,
        active: true,
        _count: {
          select: { services: true },
        },
      },
    });

    return jsonResponse({ data: serviceTypes });
  } catch (error) {
    console.error("[GET /api/mobile/service-types] Error:", error);
    return errorResponse("Failed to fetch service types", 500);
  }
}
