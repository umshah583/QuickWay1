import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { priceCents: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        priceCents: true,
      },
    });
    return jsonResponse({ data: services });
  } catch (error) {
    console.error("[services][GET]", error);
    return errorResponse("Unable to load services", 500);
  }
}

export function OPTIONS() {
  return noContentResponse();
}
