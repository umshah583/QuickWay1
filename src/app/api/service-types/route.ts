import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const serviceTypes = await prisma.serviceType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        color: true,
        attributes: true,
        _count: {
          select: { services: true },
        },
      },
    });

    return NextResponse.json({ data: serviceTypes });
  } catch (error) {
    console.error("[GET /api/service-types] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch service types" },
      { status: 500 }
    );
  }
}
