import { NextRequest, NextResponse } from "next/server";
import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePartnerSession();
    const partnerUserId = session.user?.id;

    if (!partnerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: partnerUserId },
      select: { id: true },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const driver = await prisma.user.findFirst({
      where: {
        id: params.id,
        partnerId: partner.id,
        role: "DRIVER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        createdAt: true,
        role: true,
        partnerId: true,
      },
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    return NextResponse.json(driver);
  } catch (error) {
    console.error("Error fetching driver:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
