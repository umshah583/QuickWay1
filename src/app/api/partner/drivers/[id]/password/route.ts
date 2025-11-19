import { NextRequest, NextResponse } from "next/server";
import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
        id,
        partnerId: partner.id,
        role: "DRIVER",
      },
      select: { id: true },
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found or not authorized" }, { status: 404 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
