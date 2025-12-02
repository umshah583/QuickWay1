import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST() {
  try {
    // Check if admin
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all users without email verification
    const unverifiedUsers = await prisma.user.findMany({
      where: {
        emailVerified: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (unverifiedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All users are already verified!",
        count: 0,
      });
    }

    // Update all unverified users
    const result = await prisma.user.updateMany({
      where: {
        emailVerified: null,
      },
      data: {
        emailVerified: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully verified ${result.count} users`,
      count: result.count,
      users: unverifiedUsers.map(u => ({
        email: u.email,
        name: u.name,
      })),
    });
  } catch (error) {
    console.error("Error verifying users:", error);
    return NextResponse.json(
      { error: "Failed to verify users" },
      { status: 500 }
    );
  }
}
