import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST - Manually verify user's email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = await prisma.user.update({
      where: { id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
      user,
    });
  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
}

// DELETE - Unverify user's email
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = await prisma.user.update({
      where: { id },
      data: {
        emailVerified: null,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email verification removed",
      user,
    });
  } catch (error) {
    console.error("Error unverifying email:", error);
    return NextResponse.json(
      { error: "Failed to unverify email" },
      { status: 500 }
    );
  }
}
